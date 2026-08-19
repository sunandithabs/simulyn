'use client';

import { ArrowBigUp, MessageSquare, Pin, Reply, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { DiscussionPost } from '@/lib/types';
import { cn, relativeTime } from '@/lib/utils';

interface CardHandlers {
  isStaff: boolean;
  busy: boolean;
  replyTo: string | null;
  replyDraft: string;
  onReplyDraft: (value: string) => void;
  onToggleReply: (id: string) => void;
  onUpvote: (id: string) => void;
  onPin: (post: DiscussionPost) => void;
  onDelete: (id: string) => void;
  onSubmitReply: (parentId: string) => void;
}

/**
 * Declared at module scope on purpose: a component defined inside the parent
 * gets a new identity on every render, which would remount the reply box and
 * steal focus on each keystroke.
 */
function PostCard({
  post,
  depth,
  handlers,
}: {
  post: DiscussionPost;
  depth: number;
  handlers: CardHandlers;
}) {
  return (
    <div className={cn(depth > 0 && 'mt-2.5 ml-4 border-l border-line pl-4 sm:ml-6')}>
      <article
        className={cn(
          'rounded-lg border p-3',
          post.isPinned ? 'border-brass/30 bg-brass/[0.05]' : 'border-line bg-white/[0.02]',
        )}
      >
        <header className="flex items-center gap-2.5">
          <Avatar name={post.author.displayName} avatar={post.author.avatar} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-paper">
                {post.author.displayName}
              </span>
              {post.author.role !== 'STUDENT' ? (
                <Badge tone="violet">{post.author.role.toLowerCase()}</Badge>
              ) : null}
              {post.isPinned ? <Badge tone="brass">pinned</Badge> : null}
            </div>
            <span className="font-mono text-[10px] text-faint">{relativeTime(post.createdAt)}</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {handlers.isStaff && !post.isDeleted ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={post.isPinned ? 'Unpin post' : 'Pin post'}
                onClick={() => handlers.onPin(post)}
              >
                <Pin className={cn('h-3.5 w-3.5', post.isPinned && 'text-brass-lit')} />
              </Button>
            ) : null}
            {post.canModerate && !post.isDeleted ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete post"
                onClick={() => handlers.onDelete(post.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </header>

        {post.isDeleted ? (
          <p className="mt-2.5 text-[13px] text-faint italic">This post was deleted.</p>
        ) : (
          <div className="prose-lab mt-2.5 text-[13.5px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>
        )}

        {!post.isDeleted ? (
          <footer className="mt-2.5 flex items-center gap-1">
            <button
              onClick={() => handlers.onUpvote(post.id)}
              aria-pressed={post.hasUpvoted}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                post.hasUpvoted
                  ? 'border-violet-lit/40 bg-violet/15 text-violet-lit'
                  : 'border-line text-muted hover:border-white/25 hover:text-paper',
              )}
            >
              <ArrowBigUp className="h-3.5 w-3.5" />
              {post.upvotes}
            </button>

            {depth === 0 ? (
              <Button variant="ghost" size="sm" onClick={() => handlers.onToggleReply(post.id)}>
                <Reply className="h-3.5 w-3.5" />
                Reply
              </Button>
            ) : null}
          </footer>
        ) : null}

        {handlers.replyTo === post.id ? (
          <div className="mt-3 border-t border-line pt-3">
            <Textarea
              rows={3}
              autoFocus
              value={handlers.replyDraft}
              onChange={(event) => handlers.onReplyDraft(event.target.value)}
              placeholder="Write a reply. Fence code with ``` to keep it formatted."
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                loading={handlers.busy}
                disabled={!handlers.replyDraft.trim()}
                onClick={() => handlers.onSubmitReply(post.id)}
              >
                Post reply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handlers.onToggleReply(post.id)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </article>

      {post.replies.map((reply) => (
        <PostCard key={reply.id} post={reply} depth={depth + 1} handlers={handlers} />
      ))}
    </div>
  );
}

/**
 * Per-problem discussion. Markdown so students can paste fenced code, and one
 * upvote per account so the useful answer rises without being gameable.
 */
export function DiscussionThread({ problemId }: { problemId: string }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<DiscussionPost[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const load = useCallback(() => {
    void api
      .get<DiscussionPost[]>(`/problems/${problemId}/discussions`)
      .then(setPosts)
      .catch(() => setPosts([]));
  }, [problemId]);

  useEffect(load, [load]);

  const createPost = useCallback(
    async (content: string, parentId?: string) => {
      if (!content.trim()) return;
      setBusy(true);
      try {
        await api.post(`/problems/${problemId}/discussions`, {
          content: content.trim(),
          parentId,
        });
        setDraft('');
        setReplyDraft('');
        setReplyTo(null);
        load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not post that');
      } finally {
        setBusy(false);
      }
    },
    [problemId, load],
  );

  const handlers: CardHandlers = {
    isStaff: user?.role === 'TEACHER' || user?.role === 'ADMIN',
    busy,
    replyTo,
    replyDraft,
    onReplyDraft: setReplyDraft,
    onToggleReply: (id) => {
      setReplyTo((current) => (current === id ? null : id));
      setReplyDraft('');
    },
    onUpvote: (id) => {
      void api
        .post(`/discussions/${id}/upvote`)
        .then(load)
        .catch((error: Error) => toast.error(error.message));
    },
    onPin: (post) => {
      void api
        .patch(`/discussions/${post.id}`, { isPinned: !post.isPinned })
        .then(() => {
          toast.success(post.isPinned ? 'Unpinned' : 'Pinned to the top');
          load();
        })
        .catch((error: Error) => toast.error(error.message));
    },
    onDelete: (id) => {
      if (!window.confirm('Delete this post?')) return;
      void api
        .delete(`/discussions/${id}`)
        .then(load)
        .catch((error: Error) => toast.error(error.message));
    },
    onSubmitReply: (parentId) => void createPost(replyDraft, parentId),
  };

  return (
    <section className="mt-8 border-t border-line pt-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-violet-lit" strokeWidth={1.8} />
        <span className="instrument">Discussion</span>
        {posts ? (
          <span className="font-mono text-[11px] text-faint tabular">{posts.length}</span>
        ) : null}
      </div>

      <div className="mt-4">
        <Textarea
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question or share an approach. Fence code with ``` — no full solutions."
        />
        <Button
          className="mt-2"
          size="sm"
          loading={busy}
          disabled={!draft.trim()}
          onClick={() => void createPost(draft)}
        >
          Post
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {posts === null ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-faint">
            No one has posted yet. Start the thread.
          </p>
        ) : (
          posts.map((entry) => (
            <PostCard key={entry.id} post={entry} depth={0} handlers={handlers} />
          ))
        )}
      </div>
    </section>
  );
}
