import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@simulyn/shared';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { ProctoringGateway } from '../proctoring/proctoring.gateway';

/** Secrets are never echoed back — only whether they are configured. */
function maskSecret(value: string | null | undefined): string {
  if (!value) return 'not set';
  if (value.length <= 8) return 'set';
  return `set (…${value.slice(-4)})`;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly execution: ExecutionService,
    private readonly proctoring: ProctoringGateway,
  ) {}

  /** Counts for the admin landing page. */
  async overview() {
    const [users, byRole, classes, problems, publishedProblems, submissions, exams, attempts] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        this.prisma.class.count(),
        this.prisma.problem.count(),
        this.prisma.problem.count({ where: { isPublished: true } }),
        this.prisma.submission.count(),
        this.prisma.exam.count(),
        this.prisma.examAttempt.count({ where: { submittedAt: null } }),
      ]);

    const now = new Date();
    const activeExams = await this.prisma.exam.count({
      where: { isPublished: true, scheduledStart: { lte: now }, scheduledEnd: { gte: now } },
    });

    return {
      users: {
        total: users,
        students: byRole.find((r) => r.role === Role.STUDENT)?._count._all ?? 0,
        teachers: byRole.find((r) => r.role === Role.TEACHER)?._count._all ?? 0,
        admins: byRole.find((r) => r.role === Role.ADMIN)?._count._all ?? 0,
        inactive: await this.prisma.user.count({ where: { isActive: false } }),
      },
      classes,
      problems: { total: problems, published: publishedProblems },
      submissions,
      exams: { total: exams, active: activeExams },
      attemptsInProgress: attempts,
    };
  }

  /** Where the SQLite file actually lives, so we can measure it. */
  private async databaseSize(): Promise<{ bytes: number | null; path: string | null }> {
    const url = process.env.DATABASE_URL ?? '';
    if (!url.startsWith('file:')) return { bytes: null, path: null };

    const relative = url.slice('file:'.length);
    let file: string;

    if (isAbsolute(relative)) {
      file = relative;
    } else {
      // Relative SQLite paths resolve against the schema directory.
      try {
        const require = createRequire(__filename);
        const sharedPkg = require.resolve('@simulyn/shared/package.json');
        file = resolve(join(dirname(sharedPkg), 'prisma'), relative);
      } catch {
        return { bytes: null, path: null };
      }
    }

    try {
      const info = await stat(file);
      return { bytes: info.size, path: file };
    } catch {
      return { bytes: null, path: file };
    }
  }

  async health() {
    const memory = process.memoryUsage();
    const database = await this.databaseSize();

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      startedAt: new Date(this.startedAt).toISOString(),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      environment: this.config.get<string>('nodeEnv'),
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
      },
      database: {
        provider: (process.env.DATABASE_URL ?? '').startsWith('file:') ? 'sqlite' : 'postgresql',
        sizeBytes: database.bytes,
        path: database.path,
      },
      execution: this.execution.health(),
      websockets: {
        namespace: '/proctoring',
        connected: this.proctoring.connectionCount,
      },
    };
  }

  /**
   * Effective runtime configuration, read-only.
   *
   * These come from the environment and are read when the process boots, so
   * changing one means editing the env and restarting — there is no settings
   * store to write to, and inventing one for secrets like an API key would be
   * worse than the env var it replaced.
   */
  settings() {
    return {
      readOnly: true,
      groups: [
        {
          key: 'mentor',
          label: 'AI mentor',
          note: 'The local model is tried first; the cloud provider is only a fallback.',
          entries: [
            { env: 'OLLAMA_URL', label: 'Ollama URL', value: this.config.get<string>('mentor.ollamaUrl') },
            { env: 'OLLAMA_MODEL', label: 'Ollama model', value: this.config.get<string>('mentor.ollamaModel') },
            {
              env: 'CLOUD_LLM_PROVIDER',
              label: 'Cloud fallback',
              value: this.config.get<string>('mentor.cloudProvider') ?? 'not set',
            },
            {
              env: 'CLOUD_LLM_MODEL',
              label: 'Cloud model',
              value: this.config.get<string>('mentor.cloudModel'),
            },
            {
              env: 'CLOUD_LLM_API_KEY',
              label: 'Cloud API key',
              value: maskSecret(this.config.get<string>('mentor.cloudApiKey')),
              secret: true,
            },
          ],
        },
        {
          key: 'execution',
          label: 'Code execution',
          note: 'Applied when the process starts; the semaphore is sized once.',
          entries: [
            {
              env: 'EXEC_MAX_CONCURRENCY',
              label: 'Max concurrent executions',
              value: String(this.config.get<number>('execution.maxConcurrency')),
            },
            {
              env: 'EXEC_TIMEOUT_MS',
              label: 'Wall-clock timeout',
              value: `${this.config.get<number>('execution.timeoutMs')} ms`,
            },
            { env: '—', label: 'Max code length', value: '100000 characters' },
            { env: 'PYTHON_BIN', label: 'Python binary', value: process.env.PYTHON_BIN ?? 'auto-detected' },
            { env: 'CXX_BIN', label: 'C++ compiler', value: process.env.CXX_BIN ?? 'auto-detected' },
            { env: 'JAVAC_BIN', label: 'Java compiler', value: process.env.JAVAC_BIN ?? 'auto-detected' },
          ],
        },
        {
          key: 'limits',
          label: 'Rate limits',
          note: 'Counted per account, falling back to IP for signed-out routes.',
          entries: [
            { env: '—', label: 'Default', value: '300 requests / minute' },
            { env: '—', label: 'POST /execute/run and /submissions', value: '30 / minute' },
            { env: '—', label: 'POST /mentor/hint', value: '10 / minute' },
            { env: '—', label: 'POST /analytics/classroom-insights', value: '10 / minute' },
            { env: '—', label: 'POST /problems/:id/discussions', value: '20 / minute' },
          ],
        },
        {
          key: 'auth',
          label: 'Authentication',
          entries: [
            { env: 'JWT_EXPIRES_IN', label: 'Access token lifetime', value: this.config.get<string>('jwt.expiresIn') },
            {
              env: 'JWT_REFRESH_EXPIRES_IN',
              label: 'Refresh token lifetime',
              value: this.config.get<string>('jwt.refreshExpiresIn'),
            },
            { env: 'JWT_SECRET', label: 'Access token secret', value: maskSecret(this.config.get<string>('jwt.secret')), secret: true },
            {
              env: 'JWT_REFRESH_SECRET',
              label: 'Refresh token secret',
              value: maskSecret(this.config.get<string>('jwt.refreshSecret')),
              secret: true,
            },
            { env: 'CORS_ORIGIN', label: 'Allowed origins', value: (this.config.get<string[]>('corsOrigin') ?? []).join(', ') },
          ],
        },
      ],
    };
  }
}
