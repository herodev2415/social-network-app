import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date?: string | null) {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function initials(name?: string | null) {
  if (!name) return "SC";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
