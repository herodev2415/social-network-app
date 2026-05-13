import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { cn } from "@/lib/utils";

type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

type ReactionPickerProps = {
  targetType: "post" | "comment";
  targetId: string;
  userId?: string | null;
  compact?: boolean;
  onChanged?: () => void | Promise<void>;
};

const REACTIONS: {
  type: ReactionType;
  emoji: string;
  label: string;
}[] = [
  { type: "like", emoji: "👍", label: "J’aime" },
  { type: "love", emoji: "❤️", label: "J’adore" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Waouh" },
  { type: "sad", emoji: "😢", label: "Triste" },
  { type: "angry", emoji: "😡", label: "Grrr" },
];

function isReactionType(value: string): value is ReactionType {
  return REACTIONS.some((reaction) => reaction.type === value);
}

export function ReactionPicker({
  targetType,
  targetId,
  userId,
  compact = false,
  onChanged,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [counts, setCounts] = useState<Partial<Record<ReactionType, number>>>(
    {}
  );
  const [reacting, setReacting] = useState(false);

  const table =
    targetType === "post" ? "post_reactions" : "comment_reactions";

  const idColumn = targetType === "post" ? "post_id" : "comment_id";

  const selectedReaction = useMemo(
    () => REACTIONS.find((reaction) => reaction.type === myReaction),
    [myReaction]
  );

  const total = Object.values(counts).reduce(
    (sum, value) => sum + (value ?? 0),
    0
  );

  const loadReactions = useCallback(async () => {
    if (!targetId) return;

    const { data, error } = await supabase
      .from(table)
      .select("reaction_type, user_id")
      .eq(idColumn, targetId);

    if (error) {
      console.error(error.message);
      return;
    }

    const nextCounts: Partial<Record<ReactionType, number>> = {};
    let nextMyReaction: ReactionType | null = null;

    for (const row of data ?? []) {
      const type = String(row.reaction_type);

      if (!isReactionType(type)) continue;

      nextCounts[type] = (nextCounts[type] ?? 0) + 1;

      if (userId && row.user_id === userId) {
        nextMyReaction = type;
      }
    }

    setCounts(nextCounts);
    setMyReaction(nextMyReaction);
  }, [idColumn, table, targetId, userId]);

  function applyLocalReaction(
    previousReaction: ReactionType | null,
    nextReaction: ReactionType | null
  ) {
    setCounts((previousCounts) => {
      const nextCounts = { ...previousCounts };

      if (previousReaction) {
        nextCounts[previousReaction] = Math.max(
          0,
          (nextCounts[previousReaction] ?? 0) - 1
        );

        if (nextCounts[previousReaction] === 0) {
          delete nextCounts[previousReaction];
        }
      }

      if (nextReaction) {
        nextCounts[nextReaction] = (nextCounts[nextReaction] ?? 0) + 1;
      }

      return nextCounts;
    });

    setMyReaction(nextReaction);
  }

  async function react(reactionType: ReactionType) {
    if (!userId) {
      toast.error("Vous devez être connecté pour réagir.");
      return;
    }

    if (reacting) return;

    const previousReaction = myReaction;
    const previousCounts = counts;

    setReacting(true);
    setOpen(false);

    if (previousReaction === reactionType) {
      applyLocalReaction(previousReaction, null);

      const { error } = await supabase
        .from(table)
        .delete()
        .eq(idColumn, targetId)
        .eq("user_id", userId);

      setReacting(false);

      if (error) {
        setMyReaction(previousReaction);
        setCounts(previousCounts);
        toast.error(error.message);
        return;
      }

      await onChanged?.();
      return;
    }

    applyLocalReaction(previousReaction, reactionType);

    const payload =
      targetType === "post"
        ? {
            post_id: targetId,
            user_id: userId,
            reaction_type: reactionType,
          }
        : {
            comment_id: targetId,
            user_id: userId,
            reaction_type: reactionType,
          };

    const { error } = await supabase.from(table).upsert(payload, {
      onConflict: `${idColumn},user_id`,
    });

    setReacting(false);

    if (error) {
      setMyReaction(previousReaction);
      setCounts(previousCounts);
      toast.error(error.message);
      return;
    }

    await onChanged?.();
  }

  useEffect(() => {
    void loadReactions();
  }, [loadReactions]);

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={reacting}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
          selectedReaction ? "text-primary" : "text-muted-foreground",
          compact && "px-2 py-1 text-xs"
        )}
      >
        <span>{selectedReaction?.emoji ?? "👍"}</span>

        {!compact && <span>{selectedReaction?.label ?? "Réagir"}</span>}

        {total > 0 && (
          <span className="text-xs text-muted-foreground">{total}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 flex gap-1 rounded-full border bg-white p-2 shadow-xl dark:bg-slate-900">
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              type="button"
              title={reaction.label}
              onClick={() => react(reaction.type)}
              disabled={reacting}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full text-xl transition hover:scale-125 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                myReaction === reaction.type && "bg-primary/10"
              )}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}