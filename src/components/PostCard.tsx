import { useState } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Share2,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CommentSection } from "./CommentSection";
import { ReactionPicker } from "@/components/ReactionPicker";

import { timeAgo } from "@/lib/utils";

type PostCardProps = {
  post: any;
  onChange?: () => void;
};

export function PostCard({ post, onChange }: PostCardProps) {
  const { user } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const authorId = post?.user_id || post?.profiles?.id || null;

  const authorName =
    post?.profiles?.full_name ||
    post?.profiles?.username ||
    "Utilisateur";

  const authorUsername = post?.profiles?.username || "profil";

  async function handleDelete() {
    if (!user || user.id !== post.user_id) return;

    const confirmDelete = window.confirm("Supprimer cette publication ?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", post.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Publication supprimée.");
    onChange?.();
  }

  async function handleShare() {
    try {
      const url = authorId
        ? `${window.location.origin}/profile/${authorId}`
        : window.location.href;

      await navigator.clipboard.writeText(url);
      toast.success("Lien copié.");
    } catch {
      toast.success("Publication prête à être partagée.");
    }
  }

  return (
    <Card className="glass-panel overflow-hidden p-0">
      <div className="flex items-start gap-3 p-4">
        {authorId ? (
          <Link to={`/profile/${authorId}`}>
            <Avatar
              src={post?.profiles?.avatar_url}
              name={authorName}
              className="h-11 w-11"
            />
          </Link>
        ) : (
          <Avatar
            src={post?.profiles?.avatar_url}
            name={authorName}
            className="h-11 w-11"
          />
        )}

        <div className="min-w-0 flex-1">
          {authorId ? (
            <Link
              to={`/profile/${authorId}`}
              className="block truncate font-bold leading-tight hover:underline"
            >
              {authorName}
            </Link>
          ) : (
            <div className="truncate font-bold leading-tight">{authorName}</div>
          )}

          <div className="text-xs text-muted-foreground">
            @{authorUsername} · {timeAgo(post.created_at)}
          </div>
        </div>

        {user?.id === post.user_id ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            title="Supprimer"
          >
            <Trash2 size={16} />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" title="Options">
            <MoreHorizontal size={17} />
          </Button>
        )}
      </div>

      {post.content && (
        <p className="whitespace-pre-wrap px-4 pb-4 text-[15px] leading-7 text-foreground/90">
          {post.content}
        </p>
      )}

      {post.media_url && post.media_type === "image" && (
        <div className="flex w-full justify-center bg-black/5 dark:bg-white/5">
          <img
            src={post.media_url}
            alt="Publication"
            className="max-h-[680px] w-full max-w-full object-contain"
          />
        </div>
      )}

      {post.media_url && post.media_type === "video" && (
        <video
          src={post.media_url}
          className="max-h-[680px] w-full bg-black object-contain"
          controls
        />
      )}

      <div className="grid grid-cols-3 border-t bg-muted/20 p-2">
        <div className="flex items-center justify-center">
          <ReactionPicker
            targetType="post"
            targetId={post.id}
            userId={user?.id}
            onChanged={onChange}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCommentsOpen((value) => !value)}
          className="gap-2 rounded-xl"
        >
          <MessageCircle size={17} />
          {post.comments_count ?? 0}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="gap-2 rounded-xl"
        >
          <Share2 size={17} />
          Partager
        </Button>
      </div>

      {commentsOpen && (
        <div className="border-t bg-muted/20 p-3">
          <CommentSection postId={post.id} onChanged={onChange} />
        </div>
      )}
    </Card>
  );
}