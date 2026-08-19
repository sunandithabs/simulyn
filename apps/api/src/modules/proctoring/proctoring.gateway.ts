import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@simulyn/shared';
import type { Server, Socket } from 'socket.io';

import type { AuthenticatedUser, JwtPayload } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { examDeadline } from '../submissions/submissions.service';
import { RecordViolationDto } from './dto/violation.dto';
import { ProctoringService, type TerminationResult } from './proctoring.service';

interface SocketData {
  user?: AuthenticatedUser;
  /**
   * Assigned synchronously during handleConnection. Socket.IO delivers client
   * events as soon as the transport is up — which can be before the async
   * handshake check finishes — so handlers await this instead of reading
   * `user` directly.
   */
  auth?: Promise<AuthenticatedUser | null>;
  examId?: string;
  attemptId?: string;
}

type ProctorSocket = Socket & { data: SocketData };

export const examRoom = (examId: string) => `exam:${examId}`;
export const teacherRoom = (examId: string) => `teacher:${examId}`;
/** One room per attempt, so a message can reach a single student. */
export const attemptRoom = (attemptId: string) => `attempt:${attemptId}`;

/**
 * Real-time proctoring channel.
 *
 * Students push violations and a 5-second heartbeat; teachers subscribe to the
 * per-exam teacher room and receive both as they happen.
 */
@WebSocketGateway({
  namespace: '/proctoring',
  cors: { origin: true, credentials: true },
})
export class ProctoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ProctoringGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly proctoring: ProctoringService,
    private readonly prisma: PrismaService,
  ) {}

  // ── connection lifecycle ───────────────────────────────────────────

  handleConnection(client: ProctorSocket): void {
    // Set synchronously so an early client event can await the same promise.
    const auth: Promise<AuthenticatedUser | null> = this.authenticate(client);
    client.data.auth = auth;

    void auth.then((user) => {
      if (user) {
        this.logger.log(`${user.username} connected to proctoring`);
        return;
      }
      client.emit('unauthorized', { message: 'Invalid or missing access token' });
      client.disconnect(true);
    });
  }

  private async authenticate(client: ProctorSocket): Promise<AuthenticatedUser | null> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      const user = await this.auth.findActiveUser(payload.sub);
      if (!user) throw new Error('account not found');

      client.data.user = user;
      return user;
    } catch (error) {
      this.logger.warn(`Rejected proctoring connection: ${(error as Error).message}`);
      return null;
    }
  }

  /** Resolves the handshake before any message handler touches `data.user`. */
  private async requireUser(client: ProctorSocket): Promise<AuthenticatedUser | null> {
    const cached = client.data.user as AuthenticatedUser | undefined;
    if (cached) return cached;

    const pending = client.data.auth as Promise<AuthenticatedUser | null> | undefined;
    return (await pending) ?? null;
  }

  handleDisconnect(client: ProctorSocket): void {
    const { user, examId, attemptId } = client.data ?? {};
    if (!user || !examId) return;

    if (user.role === Role.STUDENT) {
      this.server.to(teacherRoom(examId)).emit('student-disconnected', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        attemptId,
        at: new Date().toISOString(),
      });
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token.replace(/^Bearer\s+/i, '');

    const query = client.handshake.query as Record<string, string | string[] | undefined>;
    const queryToken = query?.token;
    if (typeof queryToken === 'string') return queryToken;

    const header = client.handshake.headers.authorization;
    if (header) return header.replace(/^Bearer\s+/i, '');

    return null;
  }

  // ── rooms ──────────────────────────────────────────────────────────

  @SubscribeMessage('join-exam')
  async joinExam(
    @ConnectedSocket() client: ProctorSocket,
    @MessageBody() body: { examId: string; attemptId?: string },
  ) {
    const user = await this.requireUser(client);
    if (!user) return { ok: false, error: 'Not authenticated' };
    if (!body?.examId) return { ok: false, error: 'examId is required' };

    const exam = await this.prisma.exam.findUnique({
      where: { id: body.examId },
      include: { class: { select: { teacherId: true } } },
    });
    if (!exam) return { ok: false, error: 'Exam not found' };

    client.data.examId = body.examId;

    if (user.role === Role.STUDENT) {
      const enrolled = await this.prisma.enrollment.count({
        where: { classId: exam.classId, userId: user.id },
      });
      if (enrolled === 0) return { ok: false, error: 'You are not enrolled in this class' };

      const attempt = await this.prisma.examAttempt.findUnique({
        where: { examId_userId: { examId: body.examId, userId: user.id } },
      });
      client.data.attemptId = attempt?.id;

      await client.join(examRoom(body.examId));
      if (attempt) await client.join(attemptRoom(attempt.id));

      this.server.to(teacherRoom(body.examId)).emit('student-joined', {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        attemptId: attempt?.id ?? null,
        integrityScore: attempt?.integrityScore ?? this.proctoring.initialIntegrityScore,
        at: new Date().toISOString(),
      });

      return { ok: true, room: examRoom(body.examId), attemptId: attempt?.id ?? null };
    }

    // Teachers and admins observe.
    if (user.role === Role.TEACHER && exam.class.teacherId !== user.id) {
      return { ok: false, error: 'You do not proctor this exam' };
    }

    await client.join(teacherRoom(body.examId));
    await client.join(examRoom(body.examId));

    const board = await this.proctoring.liveBoard(body.examId, user);
    return { ok: true, room: teacherRoom(body.examId), board };
  }

  // ── student events ─────────────────────────────────────────────────

  @SubscribeMessage('violation')
  async violation(
    @ConnectedSocket() client: ProctorSocket,
    @MessageBody() body: RecordViolationDto,
  ) {
    const user = await this.requireUser(client);
    if (!user) return { ok: false, error: 'Not authenticated' };

    try {
      const recorded = await this.proctoring.record(body, user);
      client.data.attemptId = recorded.examAttemptId;

      this.server.to(teacherRoom(recorded.examId)).emit('student-violation', recorded);

      // A separate event, emitted once, so the proctor view can raise an alarm
      // rather than inferring it from a count in the violation feed.
      if (recorded.justFlagged) {
        this.server.to(teacherRoom(recorded.examId)).emit('student-flagged', {
          attemptId: recorded.examAttemptId,
          examId: recorded.examId,
          userId: recorded.userId,
          username: recorded.username,
          displayName: recorded.displayName,
          violationCount: recorded.violationCount,
          integrityScore: recorded.integrityScore,
          at: new Date().toISOString(),
        });

        // Crossing the threshold ends the attempt — tell the student too.
        this.announceTerminated({
          attemptId: recorded.examAttemptId,
          examId: recorded.examId,
          userId: recorded.userId,
          username: recorded.username,
          displayName: recorded.displayName,
          reason: `Automatically removed after ${recorded.violationCount} violations`,
          by: null,
          violationCount: recorded.violationCount,
          integrityScore: recorded.integrityScore,
          totalScore: 0,
          at: new Date(),
        });
      }

      return {
        ok: true,
        integrityScore: recorded.integrityScore,
        violationCount: recorded.violationCount,
        flagged: recorded.flagged,
        terminated: recorded.terminated,
      };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  @SubscribeMessage('heartbeat')
  async heartbeat(
    @ConnectedSocket() client: ProctorSocket,
    @MessageBody()
    body: { examAttemptId: string; currentQuestion?: number; timeRemaining?: number },
  ) {
    const user = await this.requireUser(client);
    if (!user || !body?.examAttemptId) return { ok: false };

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: body.examAttemptId },
      include: { exam: true },
    });
    if (!attempt || attempt.userId !== user.id) return { ok: false, error: 'Unknown attempt' };

    client.data.examId = attempt.examId;
    client.data.attemptId = attempt.id;

    // Backstop for a student who was offline when they were removed: the live
    // broadcast missed them, so the next heartbeat closes their paper.
    if (attempt.terminated) {
      client.emit('student-terminated', {
        attemptId: attempt.id,
        examId: attempt.examId,
        userId: attempt.userId,
        reason: attempt.terminatedReason ?? 'Removed from the exam',
        by: attempt.terminatedBy,
        violationCount: await this.prisma.violation.count({
          where: { examAttemptId: attempt.id },
        }),
        at: (attempt.terminatedAt ?? new Date()).toISOString(),
      });
      return { ok: false, error: 'You have been removed from this exam' };
    }

    const endsAt = examDeadline(attempt.startedAt, attempt.exam);
    const expired = Date.now() > endsAt.getTime();

    this.server.to(teacherRoom(attempt.examId)).emit('student-heartbeat', {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      attemptId: attempt.id,
      currentQuestion: body.currentQuestion ?? null,
      timeRemaining: body.timeRemaining ?? Math.max(0, Math.round((endsAt.getTime() - Date.now()) / 1000)),
      integrityScore: attempt.integrityScore,
      submitted: attempt.submittedAt !== null,
      at: new Date().toISOString(),
    });

    if (expired && !attempt.submittedAt) {
      // The client should already be auto-submitting; this is the backstop.
      client.emit('exam-ended', { examId: attempt.examId, attemptId: attempt.id, endsAt });
      this.server.to(teacherRoom(attempt.examId)).emit('exam-ended', {
        examId: attempt.examId,
        attemptId: attempt.id,
        userId: user.id,
      });
    }

    return { ok: true, endsAt, expired };
  }

  /**
   * Live socket count on this namespace, for the admin health panel.
   *
   * A namespaced gateway is handed a Namespace rather than a Server, and its
   * `sockets` is a Map — the Server type declares that property as a Namespace,
   * so the shape is narrowed here rather than at the field.
   */
  get connectionCount(): number {
    const namespace = this.server as unknown as { sockets?: { size?: number } };
    return namespace?.sockets?.size ?? 0;
  }

  /** Broadcast helper used when an exam window closes for everyone. */
  announceExamEnded(examId: string): void {
    this.server?.to(examRoom(examId)).emit('exam-ended', { examId, at: new Date().toISOString() });
  }

  /**
   * A student has been removed from the exam. The student's own room closes the
   * paper on their screen immediately; the teacher room updates the board. It
   * deliberately does not reach the rest of the cohort.
   */
  announceTerminated(result: TerminationResult): void {
    const payload = { ...result, at: new Date(result.at).toISOString() };
    this.server
      ?.to(attemptRoom(result.attemptId))
      .to(teacherRoom(result.examId))
      .emit('student-terminated', payload);
  }

  /** A proctor has let a removed student back in. */
  announceReadmitted(result: {
    attemptId: string;
    examId: string;
    userId: string;
    username: string;
    displayName: string;
    by: string;
    at: Date;
  }): void {
    const payload = { ...result, at: new Date(result.at).toISOString() };
    this.server
      ?.to(attemptRoom(result.attemptId))
      .to(teacherRoom(result.examId))
      .emit('student-readmitted', payload);
  }
}
