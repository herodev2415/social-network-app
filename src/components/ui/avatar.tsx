import { cn, initials } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-100 to-pink-100 p-[2px] text-xs font-bold text-primary dark:from-indigo-900 dark:to-pink-900",
        className
      )}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card">
        {src ? (
          <img src={src} alt={name ?? "avatar"} className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </div>
    </div>
  );
}