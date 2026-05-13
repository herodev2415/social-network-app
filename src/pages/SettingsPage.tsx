import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Upload, ShieldCheck } from "lucide-react";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProfileFormData = {
  full_name: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 Mo
const AVATAR_COMPRESS_LIMIT = 800 * 1024; // 800 Ko
const MAX_AVATAR_WIDTH = 512;
const MAX_AVATAR_HEIGHT = 512;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur est survenue.";
}

function normalizeWebsite(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue) return "";

  if (cleanValue.startsWith("http://") || cleanValue.startsWith("https://")) {
    return cleanValue;
  }

  return `https://${cleanValue}`;
}

async function compressAvatar(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= AVATAR_COMPRESS_LIMIT) return file;

  const bitmap = await createImageBitmap(file);

  const ratio = Math.min(
    MAX_AVATAR_WIDTH / bitmap.width,
    MAX_AVATAR_HEIGHT / bitmap.height,
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

        resolve(
          new File([blob], `avatar-${Date.now()}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          })
        );
      },
      "image/webp",
      0.82
    );
  });
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [profilePublic, setProfilePublic] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setBio(profile?.bio || "");
    setLocation(profile?.location || "");
    setWebsite(profile?.website || "");
    setAvatarUrl(profile?.avatar_url || "");
  }, [profile]);

  async function uploadAvatar(file: File) {
    if (!user) {
      toast.error("Utilisateur non connecté.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir une image.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("L’image ne doit pas dépasser 5 Mo.");
      return;
    }

    setUploadingAvatar(true);

    try {
      const optimizedFile = await compressAvatar(file);
      const extension = optimizedFile.type === "image/webp" ? "webp" : "jpg";
      const filePath = `avatars/${user.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, optimizedFile, {
          cacheControl: "31536000",
          upsert: false,
          contentType: optimizedFile.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("media").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          avatar_url: publicUrl,
          full_name: fullName.trim(),
          bio: bio.trim(),
          location: location.trim(),
          website: website.trim(),
        },
        {
          onConflict: "id",
        }
      );

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(publicUrl);
      await refreshProfile();

      toast.success("Photo de profil mise à jour.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      await uploadAvatar(file);
    }

    event.target.value = "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      toast.error("Utilisateur non connecté.");
      return;
    }

    if (loading) return;

    const cleanFullName = fullName.trim();
    const cleanBio = bio.trim();
    const cleanLocation = location.trim();
    const cleanWebsite = website.trim();

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? "",
            full_name: cleanFullName,
            bio: cleanBio,
            location: cleanLocation,
            website: cleanWebsite,
            avatar_url: avatarUrl,
          },
          {
            onConflict: "id",
          }
        )
        .select("full_name, bio, location, website, avatar_url")
        .maybeSingle();

      if (error) {
        throw error;
      }

      const updatedProfile = (data ?? null) as ProfileFormData | null;

      if (updatedProfile) {
        setFullName(updatedProfile.full_name || "");
        setBio(updatedProfile.bio || "");
        setLocation(updatedProfile.location || "");
        setWebsite(updatedProfile.website || "");
        setAvatarUrl(updatedProfile.avatar_url || "");
      }

      await refreshProfile();

      toast.success("Profil mis à jour.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordLoading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      toast.success("Mot de passe modifié.");
      form.reset();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      <Card className="glass-panel p-5">
        <h1 className="mb-4 text-lg font-bold">Informations personnelles</h1>

        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
          <Avatar
            src={avatarUrl || undefined}
            name={fullName || profile?.username || "Utilisateur"}
            className="h-20 w-20"
          />

          <div>
            <p className="text-sm font-semibold">Photo de profil</p>

            <p className="mb-3 text-xs text-muted-foreground">
              Image recommandée : carrée, claire, moins de 5 Mo.
            </p>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              {uploadingAvatar ? (
                <>
                  <Upload size={16} />
                  Envoi...
                </>
              ) : (
                <>
                  <Camera size={16} />
                  Choisir une photo
                </>
              )}

              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploadingAvatar}
                onChange={handleAvatarChange}
              />
            </label>
          </div>
        </div>

        <form onSubmit={save} className="space-y-3">
          <fieldset disabled={loading || uploadingAvatar} className="space-y-3">
            <Input
              name="full_name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nom complet"
              autoComplete="name"
              maxLength={80}
            />

            <Textarea
              name="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Bio"
              maxLength={280}
            />

            <Input
              name="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Localisation"
              maxLength={120}
            />

            <Input
              name="website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              onBlur={() => setWebsite((value) => normalizeWebsite(value))}
              placeholder="Site web"
              autoComplete="url"
              maxLength={160}
            />
          </fieldset>

          <Button disabled={loading || uploadingAvatar} type="submit">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </Card>

      <Card className="glass-panel p-5">
        <h2 className="mb-4 text-lg font-bold">Mot de passe</h2>

        <form onSubmit={changePassword} className="space-y-3">
          <fieldset disabled={passwordLoading} className="space-y-3">
            <Input
              name="password"
              type="password"
              minLength={6}
              placeholder="Nouveau mot de passe"
              autoComplete="new-password"
            />

            <Input
              name="confirm_password"
              type="password"
              minLength={6}
              placeholder="Confirmer le mot de passe"
              autoComplete="new-password"
            />
          </fieldset>

          <Button disabled={passwordLoading} type="submit">
            {passwordLoading ? "Modification..." : "Changer"}
          </Button>
        </form>

        <h2 className="mb-2 mt-6 text-lg font-bold">Confidentialité</h2>

        <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} />
              Profil public
            </span>

            <input
              type="checkbox"
              checked={profilePublic}
              onChange={(event) => setProfilePublic(event.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Notifications activées</span>

            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) =>
                setNotificationsEnabled(event.target.checked)
              }
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Ces options sont préparées côté interface. Pour les rendre persistantes,
          il faudra ajouter les colonnes correspondantes dans la table
          <span className="font-semibold"> profiles</span>.
        </p>
      </Card>
    </div>
  );
}