import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import type { Comment } from "@/types/types";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReactionPicker } from "@/components/ReactionPicker";

import { timeAgo } from "@/lib/utils";

type CommentSectionProps = {
  postId: string;
  onChanged?: () => void;
};

export function CommentSection({ postId, onChanged }: CommentSectionProps) {
  const { user } = useAuth();

  const [items, setItems] = useState<Comment[]>([]);
  const [content, setContent] = useState("");

  async function load() {
    const { data, error } = await supabase
      .from("comments")
      .select("*, profiles(*)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((data as Comment[]) ?? []);
  }

  useEffect(() => {
    load();

    const ch = supabase
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
          load();
          onChanged?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !content.trim()) return;

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setContent("");
    await load();
    onChanged?.();
  }

  return (
    <div className="space-y-2 pt-2">
      {items.map((c: any) => {
        const commentAuthorId = c?.user_id || c?.profiles?.id || null;

        const commentAuthorName =
          c?.profiles?.full_name ||
          c?.profiles?.username ||
          "Utilisateur";

        return (
          <div key={c.id} className="flex gap-2 text-xs">
            {commentAuthorId ? (
              <Link to={`/profile/${commentAuthorId}`}>
                <Avatar
                  src={c?.profiles?.avatar_url}
                  name={commentAuthorName}
                  className="h-7 w-7"
                />
              </Link>
            ) : (
              <Avatar
                src={c?.profiles?.avatar_url}
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

                <div>{c.content}</div>

                <div className="text-[10px] text-muted-foreground">
                  {timeAgo(c.created_at)}
                </div>
              </div>

              <div className="mt-1">
                <ReactionPicker
                  targetType="comment"
                  targetId={c.id}
                  userId={user?.id}
                  compact
                />
              </div>
            </div>
          </div>
        );
      })}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Écrire un commentaire..."
          className="h-8 text-xs"
        />

        <Button type="submit" size="sm">
          Envoyer
        </Button>
      </form>
    </div>
  );
}