import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@simulyn/shared';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/discussion.dto';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatar: true,
  role: true,
} as const;

export interface PostView {
  id: string;
  problemId: string;
  parentId: string | null;
  content: string;
  upvotes: number;
  hasUpvoted: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  isAuthor: boolean;
  canModerate: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; username: string; displayName: string; avatar: string | null; role: Role };
  replies: PostView[];
}

@Injectable()
export class DiscussionsService {
  private readonly logger = new Logger(DiscussionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isStaff(user: AuthenticatedUser): boolean {
    return user.role === Role.TEACHER || user.role === Role.ADMIN;
  }

  /**
   * Whole thread for a problem, nested one level deep in the response but
   * tolerant of deeper chains (a reply to a reply attaches to its parent).
   */
  async listForProblem(problemId: string, requester: AuthenticatedUser): Promise<PostView[]> {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, isPublished: true },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    if (requester.role === Role.STUDENT && !problem.isPublished) {
      throw new NotFoundException(`Problem ${problemId} not found`);
    }

    const [posts, myVotes] = await Promise.all([
      this.prisma.discussionPost.findMany({
        where: { problemId },
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.discussionVote.findMany({
        where: { userId: requester.id, post: { problemId } },
        select: { postId: true },
      }),
    ]);

    const voted = new Set(myVotes.map((vote) => vote.postId));
    const staff = this.isStaff(requester);

    const toView = (post: (typeof posts)[number]): PostView => ({
      id: post.id,
      problemId: post.problemId,
      parentId: post.parentId,
      // A deleted post keeps its place in the thread so replies stay readable.
      content: post.isDeleted ? '' : post.content,
      upvotes: post.upvotes,
      hasUpvoted: voted.has(post.id),
      isPinned: post.isPinned,
      isDeleted: post.isDeleted,
      isAuthor: post.authorId === requester.id,
      canModerate: staff || post.authorId === requester.id,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      replies: [],
    });

    const byId = new Map<string, PostView>();
    for (const post of posts) byId.set(post.id, toView(post));

    const roots: PostView[] = [];
    for (const post of posts) {
      const view = byId.get(post.id)!;
      const parent = post.parentId ? byId.get(post.parentId) : undefined;
      if (parent) parent.replies.push(view);
      else roots.push(view);
    }

    // Pinned threads first, then most-upvoted, then newest.
    roots.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Drop threads that are deleted and have nothing hanging off them.
    return roots.filter((root) => !root.isDeleted || root.replies.length > 0);
  }

  async create(
    problemId: string,
    dto: CreatePostDto,
    requester: AuthenticatedUser,
  ): Promise<PostView> {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, isPublished: true },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    if (requester.role === Role.STUDENT && !problem.isPublished) {
      throw new NotFoundException(`Problem ${problemId} not found`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.discussionPost.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.problemId !== problemId) {
        throw new NotFoundException('The post you are replying to does not exist');
      }
    }

    const post = await this.prisma.discussionPost.create({
      data: {
        problemId,
        authorId: requester.id,
        parentId: dto.parentId ?? null,
        content: dto.content,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return {
      id: post.id,
      problemId: post.problemId,
      parentId: post.parentId,
      content: post.content,
      upvotes: 0,
      hasUpvoted: false,
      isPinned: false,
      isDeleted: false,
      isAuthor: true,
      canModerate: true,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      replies: [],
    };
  }

  async update(id: string, dto: UpdatePostDto, requester: AuthenticatedUser) {
    const post = await this.prisma.discussionPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post ${id} not found`);

    if (dto.content !== undefined && post.authorId !== requester.id) {
      throw new ForbiddenException('Only the author may edit a post');
    }
    if (dto.isPinned !== undefined && !this.isStaff(requester)) {
      throw new ForbiddenException('Only a teacher or admin may pin a post');
    }

    return this.prisma.discussionPost.update({
      where: { id },
      data: { content: dto.content, isPinned: dto.isPinned },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  /** Soft delete — the row stays so replies keep their context. */
  async remove(id: string, requester: AuthenticatedUser): Promise<{ success: boolean }> {
    const post = await this.prisma.discussionPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post ${id} not found`);

    if (post.authorId !== requester.id && !this.isStaff(requester)) {
      throw new ForbiddenException('Only the author, a teacher or an admin may delete a post');
    }

    await this.prisma.discussionPost.update({
      where: { id },
      data: { isDeleted: true, content: '' },
    });
    return { success: true };
  }

  /**
   * Toggles this account's vote. The DiscussionVote row is the source of
   * truth; `upvotes` is recomputed from it so the counter cannot drift.
   */
  async toggleUpvote(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<{ upvotes: number; hasUpvoted: boolean }> {
    const post = await this.prisma.discussionPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    if (post.isDeleted) throw new ForbiddenException('That post has been deleted');

    const existing = await this.prisma.discussionVote.findUnique({
      where: { postId_userId: { postId: id, userId: requester.id } },
    });

    if (existing) await this.prisma.discussionVote.delete({ where: { id: existing.id } });
    else await this.prisma.discussionVote.create({ data: { postId: id, userId: requester.id } });

    const upvotes = await this.prisma.discussionVote.count({ where: { postId: id } });
    await this.prisma.discussionPost.update({ where: { id }, data: { upvotes } });

    return { upvotes, hasUpvoted: !existing };
  }
}
