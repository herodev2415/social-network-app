import { useState } from "react";
import { Image, Video, Send, Smile } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

async function compressImage(file: File) {
  if (file.size <= 1_000_000 || !file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);

  return new Promise<File>((resolve) =>
    canvas.toBlob(
      (blob) =>
        resolve(
          new File([blob!], file.name.replace(/\.[^.]+$/, ".webp"), {
            type: "image/webp",
          })
        ),
      "image/webp",
      0.8
    )
  );
}

export function CreatePostForm({ onCreated }: { onCreated?: () => void }) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;
    if (!content.trim() && !file) return toast.error("Ajoute un texte ou un média.");

    setLoading(true);

    try {
      let media_url = null;
      let media_type = null;

      if (file) {
        if (file.type.startsWith("image/") && file.size > 10_000_000) {
          throw new Error("Image max 10 Mo.");
        }

        if (file.type.startsWith("video/") && file.size > 100_000_000) {
          throw new Error("Vidéo max 100 Mo.");
        }

        const uploadFile = await compressImage(file);
        const ext = uploadFile.name.split(".").pop();
        const path = `posts/${user.id}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from("media").upload(path, uploadFile);
        if (error) throw error;

        media_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        media_type = uploadFile.type.startsWith("video/") ? "video" : "image";
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content,
        media_url,
        media_type,
      });

      if (error) throw error;

      setContent("");
      setFile(null);
      toast.success("Publication créée.");
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Erreur de publication.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass-panel p-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-3">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.username}
            className="h-11 w-11 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Partage une pensée, une photo ou une actualité..."
              className="min-h-[92px] rounded-2xl border-transparent bg-muted/60 p-4 text-sm shadow-inner focus-visible:ring-2 focus-visible:ring-primary/30"
            />

            {file && (
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-primary/10 px-3 py-2 text-xs text-primary">
                <span className="truncate">Média sélectionné : {file.name}</span>
                <button type="button" className="font-bold" onClick={() => setFile(null)}>
                  Retirer
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex flex-wrap gap-1">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground">
              <Image size={16} /> Photo
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground">
              <Video size={16} /> Vidéo
              <input
                hidden
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <span className="hidden h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground sm:inline-flex">
              <Smile size={16} /> Humeur
            </span>
          </div>

          <Button disabled={loading} type="submit" size="sm" className="gap-2">
            {loading ? "Envoi..." : "Publier"}
            <Send size={15} />
          </Button>
        </div>
      </form>
    </Card>
  );
}