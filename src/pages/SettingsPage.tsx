import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Upload } from "lucide-react";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

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

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L’image ne doit pas dépasser 5 Mo.");
      return;
    }

    setUploadingAvatar(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setUploadingAvatar(false);
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("media").getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email,
          avatar_url: publicUrl,
          full_name: fullName,
          bio,
          location,
          website,
        },
        {
          onConflict: "id",
        }
      );

    setUploadingAvatar(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    setAvatarUrl(publicUrl);
    await refreshProfile();

    toast.success("Photo de profil mise à jour.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      toast.error("Utilisateur non connecté.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: fullName,
          bio,
          location,
          website,
          avatar_url: avatarUrl,
        },
        {
          onConflict: "id",
        }
      )
      .select("*")
      .maybeSingle();

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setFullName(data.full_name || "");
      setBio(data.bio || "");
      setLocation(data.location || "");
      setWebsite(data.website || "");
      setAvatarUrl(data.avatar_url || "");
    }

    await refreshProfile();

    toast.success("Profil mis à jour.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Mot de passe modifié.");
    event.currentTarget.reset();
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      <Card className="glass-panel p-5">
        <h1 className="mb-4 text-lg font-bold">Informations personnelles</h1>

        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
          <Avatar
            src={avatarUrl}
            name={fullName || profile?.username || "Utilisateur"}
            className="h-20 w-20"
          />

          <div>
            <p className="text-sm font-semibold">Photo de profil</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Ajoutez une image claire pour personnaliser votre profil.
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
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
              />
            </label>
          </div>
        </div>

        <form onSubmit={save} className="space-y-3">
          <Input
            name="full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nom complet"
          />

          <Textarea
            name="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Bio"
          />

          <Input
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Localisation"
          />

          <Input
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="Site web"
          />

          <Button disabled={loading} type="submit">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </Card>

      <Card className="glass-panel p-5">
        <h2 className="mb-4 text-lg font-bold">Mot de passe</h2>

        <form onSubmit={changePassword} className="space-y-3">
          <Input
            name="password"
            type="password"
            minLength={6}
            placeholder="Nouveau mot de passe"
          />

          <Button type="submit">Changer</Button>
        </form>

        <h2 className="mb-2 mt-6 text-lg font-bold">Confidentialité</h2>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" />
          Profil public
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" defaultChecked />
          Notifications activées
        </label>
      </Card>
    </div>
  );
}