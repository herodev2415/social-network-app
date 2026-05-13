import { Avatar } from "@/components/ui/avatar";
import type { Story } from "@/types/types";

export function StoryItem({ story }: { story: Story }) {
  return (
    <div className="w-16 shrink-0 text-center">
      <div className="mx-auto rounded-full bg-gradient-to-br from-pink-500 via-violet-500 to-blue-500 p-[2px]">
        <Avatar src={story.profiles?.avatar_url || story.media_url} name={story.profiles?.username} className="h-14 w-14 border-2 border-background" />
      </div>
      <div className="mt-1 truncate text-[10px]">{story.profiles?.username || "Story"}</div>
    </div>
  );
}
