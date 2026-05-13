import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReactionPicker } from "@/components/ReactionPicker";

import { timeAgo } from "@/lib/utils";

type CommentProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type CommentItem = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: CommentProfile | null;
};

type CommentSectionProps = {
  postId: string;
  onChanged?: () => void | Promise<void>;
};

export function CommentSection({ postId, onChanged }: CommentSectionProps) {
  const { user, profile } = useAuth();

  const [items, setItems] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    if (!postId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50);

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems(((data ?? []) as unknown) as CommentItem[]);
  }

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanContent = content.trim();

    if (!user) {
      toast.error("Vous devez être connecté pour commenter.");
      return;
    }

    if (!cleanContent || sending) return;

    const tempId = `temp-${crypto.randomUUID()}`;

    const optimisticComment: CommentItem = {
      id: tempId,
      post_id: postId,
      user_id: user.id,
      content: cleanContent,
      created_at: new Date().toISOString(),
      profiles: {
        id: user.id,
        username: profile?.username ?? null,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      },
    };

    setSending(true);
    setContent("");
    setItems((previousItems) => [...previousItems, optimisticComment]);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        content: cleanContent,
      })
      .select(
        `
        id,
        post_id,
        user_id,
        content,
        created_at,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `
      )
      .single();

    setSending(false);

    if (error) {
      setItems((previousItems) =>
        previousItems.filter((comment) => comment.id !== tempId)
      );
      setContent(cleanContent);
      toast.error(error.message);
      return;
    }

    if (data) {
      const savedComment = ((data as unknown) as CommentItem);

      setItems((previousItems) =>
        previousItems.map((comment) =>
          comment.id === tempId ? savedComment : comment
        )
      );
    }

    await onChanged?.();
  }

  return (
    <div className="space-y-2 pt-2">
      {loading && (
        <div className="space-y-2">
          {[1, 2].map((item) => (
            <div key={item} className="flex animate-pulse gap-2">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="flex-1 rounded-lg bg-muted p-2">
                <div className="mb-2 h-3 w-1/3 rounded bg-background/70" />
                <div className="h-3 w-2/3 rounded bg-background/70" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading &&
        items.map((comment) => {
          const commentAuthorId =
            comment.user_id || comment.profiles?.id || null;

          const commentAuthorName =
            comment.profiles?.full_name ||
            comment.profiles?.username ||
            "Utilisateur";

          return (
            <div key={comment.id} className="flex gap-2 text-xs">
              {commentAuthorId ? (
                <Link to={`/profile/${commentAuthorId}`}>
                  <Avatar
                    src={comment.profiles?.avatar_url || undefined}
                    name={commentAuthorName}
                    className="h-7 w-7"
                  />
                </Link>
              ) : (
                <Avatar
                  src={comment.profiles?.avatar_url || undefined}
                  name={commentAuthorName}
                  className="h-7 w-7"
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="rounded-lg bg-muted px-2 py-1">
                  {commentAuthorId ? (
                    <Link
                      to={`/profile/${commentAuthorId}`}
                      className="font-semibold hover:underline"
                    >
                      {commentAuthorName}
                    </Link>
                  ) : (
                    <div className="font-semibold">{commentAuthorName}</div>
                  )}

                  <div className="whitespace-pre-wrap break-words">
                    {comment.content}
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    {timeAgo(comment.created_at)}
                  </div>
                </div>

                <div className="mt-1">
                  <ReactionPicker
                    targetType="comment"
                    targetId={comment.id}
                    userId={user?.id}
                    compact
                  />
                </div>
              </div>
            </div>
          );
        })}

      {!loading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucun commentaire pour le moment.
        </p>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Écrire un commentaire..."
          disabled={sending}
          className="h-8 text-xs"
        />

        <Button type="submit" size="sm" disabled={sending || !content.trim()}>
          {sending ? "..." : "Envoyer"}
        </Button>
      </form>
    </div>
  );
}