import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Image, Video, Send, Smile, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type CreatePostFormProps = {
  onCreated?: () => void | Promise<void>;
};

type MediaType = "image" | "video" | null;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 Mo
const IMAGE_COMPRESS_LIMIT = 1 * 1024 * 1024; // 1 Mo
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 1600;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= IMAGE_COMPRESS_LIMIT) return file;

  const bitmap = await createImageBitmap(file);

  const ratio = Math.min(
    MAX_IMAGE_WIDTH / bitmap.width,
    MAX_IMAGE_HEIGHT / bitmap.height,
    1
  );

  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(file);
          return;
        }

        const cleanName = file.name.replace(/\.[^.]+$/, "");
        const compressedFile = new File([blob], `${cleanName}.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        });

        resolve(compressedFile);
      },
      "image/webp",
      0.8
    );
  });
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop();

  if (extension && extension.length <= 5) {
    return extension.toLowerCase();
  }

  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "video/mp4") return "mp4";

  return "bin";
}

function getMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function CreatePostForm({ onCreated }: CreatePostFormProps) {
  const { user, profile } = useAuth();

  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = Boolean(content.trim() || file) && !loading;

  function clearFile() {
    setFile(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const mediaType = getMediaType(selectedFile);

    if (!mediaType) {
      toast.error("Format non supporté. Choisis une image ou une vidéo.");
      event.target.value = "";
      return;
    }

    if (mediaType === "image" && selectedFile.size > MAX_IMAGE_SIZE) {
      toast.error("Image trop lourde. Maximum : 10 Mo.");
      event.target.value = "";
      return;
    }

    if (mediaType === "video" && selectedFile.size > MAX_VIDEO_SIZE) {
      toast.error("Vidéo trop lourde. Maximum : 100 Mo.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      toast.error("Tu dois être connecté pour publier.");
      return;
    }

    if (!content.trim() && !file) {
      toast.error("Ajoute un texte ou un média.");
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      let media_url: string | null = null;
      let media_type: MediaType = null;

      if (file) {
        const detectedMediaType = getMediaType(file);

        if (!detectedMediaType) {
          throw new Error("Format de fichier non supporté.");
        }

        const uploadFile =
          detectedMediaType === "image" ? await compressImage(file) : file;

        const extension = getFileExtension(uploadFile);
        const path = `posts/${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, uploadFile, {
            cacheControl: "31536000",
            upsert: false,
            contentType: uploadFile.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("media")
          .getPublicUrl(path);

        media_url = publicUrlData.publicUrl;
        media_type = detectedMediaType;
      }

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        media_url,
        media_type,
      });

      if (insertError) {
        throw insertError;
      }

      setContent("");
      clearFile();

      toast.success("Publication créée.");

      await onCreated?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erreur de publication.";

      toast.error(message);
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
            name={profile?.full_name || profile?.username}
            className="h-11 w-11 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Partage une pensée, une photo ou une actualité..."
              disabled={loading}
              className="min-h-[92px] rounded-2xl border-transparent bg-muted/60 p-4 text-sm shadow-inner focus-visible:ring-2 focus-visible:ring-primary/30"
            />

            {file && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-primary/10 px-3 py-2 text-xs text-primary">
                <span className="truncate">
                  Média sélectionné : {file.name}
                </span>

                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-bold hover:underline"
                  onClick={clearFile}
                  disabled={loading}
                >
                  <X size={13} />
                  Retirer
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex flex-wrap gap-1">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground">
              <Image size={16} />
              Photo

              <input
                ref={imageInputRef}
                hidden
                type="file"
                accept="image/*"
                disabled={loading}
                onChange={handleFileChange}
              />
            </label>

            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground">
              <Video size={16} />
              Vidéo

              <input
                ref={videoInputRef}
                hidden
                type="file"
                accept="video/*"
                disabled={loading}
                onChange={handleFileChange}
              />
            </label>

            <span className="hidden h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground sm:inline-flex">
              <Smile size={16} />
              Humeur
            </span>
          </div>

          <Button disabled={!canSubmit} type="submit" size="sm" className="gap-2">
            {loading ? "Envoi..." : "Publier"}
            <Send size={15} />
          </Button>
        </div>
      </form>
    </Card>
  );
}