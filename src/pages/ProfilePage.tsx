import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Image,
  MapPin,
  MessageCircle,
  UserPlus,
  Users,
  Globe,
  FileText,
  X,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import type { Profile } from "@/types/types";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PostCard } from "@/components/PostCard";

type FriendshipStatus = "none" | "pending" | "accepted" | "declined" | "blocked";

type FriendMini = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type FriendshipRecord = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at?: string;
  updated_at?: string;
};

type ProfileMini = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type ProfilePost = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  comments_count?: number;
  profiles?: ProfileMini | null;
  [key: string]: unknown;
};

type PhotoPost = ProfilePost & {
  media_url: string;
  media_type: "image";
};

function isPhotoPost(post: ProfilePost): post is PhotoPost {
  return (
    post.media_type === "image" &&
    typeof post.media_url === "string" &&
    post.media_url.trim().length > 0
  );
}

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const userId = id === "me" ? user?.id : id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [friends, setFriends] = useState<FriendMini[]>([]);
  const [photos, setPhotos] = useState<PhotoPost[]>([]);

  const [friendshipStatus, setFriendshipStatus] =
    useState<FriendshipStatus>("none");

  const [friendshipRecord, setFriendshipRecord] =
    useState<FriendshipRecord | null>(null);

  const [loadingFriend, setLoadingFriend] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  async function loadPosts(targetUserId: string) {
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select(
        `
        id,
        user_id,
        content,
        media_url,
        media_type,
        created_at,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `
      )
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (postsError) {
      toast.error(postsError.message);
      setPosts([]);
      setPhotos([]);
      return;
    }

    const rawPosts: ProfilePost[] = Array.isArray(postsData)
      ? (postsData as unknown as ProfilePost[])
      : [];

    const postIds = rawPosts.map((post) => post.id);

    const commentsCountByPost: Record<string, number> = {};

    if (postIds.length > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

      if (commentsError) {
        console.error(
          "Erreur chargement nombre de commentaires :",
          commentsError.message
        );
      } else {
        for (const comment of commentsData ?? []) {
          const postId = String(comment.post_id);
          commentsCountByPost[postId] = (commentsCountByPost[postId] ?? 0) + 1;
        }
      }
    }

    const nextPosts: ProfilePost[] = rawPosts.map((post) => ({
      ...post,
      comments_count: commentsCountByPost[post.id] ?? 0,
    }));

    setPosts(nextPosts);
    setPhotos(nextPosts.filter(isPhotoPost));
  }

  async function loadFriends(targetUserId: string) {
    const { data, error } = await supabase.rpc("get_profile_friends", {
      profile_user_id: targetUserId,
    });

    if (error) {
      console.error("Erreur chargement amis :", error.message);
      setFriends([]);
      return;
    }

    setFriends((data as FriendMini[]) ?? []);
  }

  async function loadFriendshipStatus(targetUserId: string) {
    if (!user || !targetUserId || user.id === targetUserId) {
      setFriendshipStatus("none");
      setFriendshipRecord(null);
      return;
    }

    const { data, error } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at, updated_at")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error.message);
      setFriendshipStatus("none");
      setFriendshipRecord(null);
      return;
    }

    if (!data) {
      setFriendshipStatus("none");
      setFriendshipRecord(null);
      return;
    }

    setFriendshipRecord(data as FriendshipRecord);
    setFriendshipStatus((data.status as FriendshipStatus) || "pending");
  }

  async function load() {
    if (!userId || userId === "undefined" || userId === "null") {
      setLoadingProfile(false);
      setProfile(null);
      return;
    }

    setLoadingProfile(true);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, location, website")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setLoadingProfile(false);
      toast.error(profileError.message);
      return;
    }

    setProfile((profileData as Profile) ?? null);

    await Promise.all([
      loadPosts(userId),
      loadFriendshipStatus(userId),
      loadFriends(userId),
    ]);

    setLoadingProfile(false);
  }

  async function refreshPostsOnly() {
    if (!userId) return;
    await loadPosts(userId);
  }

  async function addFriend() {
    if (!user || !userId) return;

    if (user.id === userId) {
      toast.error("Vous ne pouvez pas vous ajouter vous-même.");
      return;
    }

    setLoadingFriend(true);

    const { data: existingFriendship, error: checkError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at, updated_at")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`
      )
      .limit(1)
      .maybeSingle();

    if (checkError) {
      setLoadingFriend(false);
      toast.error(checkError.message);
      return;
    }

    if (existingFriendship) {
      const existing = existingFriendship as FriendshipRecord;

      if (existing.status === "pending") {
        setFriendshipRecord(existing);
        setFriendshipStatus("pending");
        setLoadingFriend(false);
        toast.info("Demande d’ami déjà envoyée.");
        return;
      }

      if (existing.status === "accepted") {
        setFriendshipRecord(existing);
        setFriendshipStatus("accepted");
        setLoadingFriend(false);
        toast.info("Vous êtes déjà amis.");
        return;
      }

      if (existing.status === "declined") {
        const { data: updatedFriendship, error: updateError } = await supabase
          .from("friendships")
          .update({
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, user_id, friend_id, status, created_at, updated_at")
          .maybeSingle();

        if (updateError) {
          setLoadingFriend(false);
          toast.error(updateError.message);
          return;
        }

        await supabase.from("notifications").insert({
          user_id: userId,
          actor_id: user.id,
          friendship_id: updatedFriendship?.id ?? existing.id,
          type: "friend_request",
          title: "Nouvelle demande d’ami",
          message: "vous a envoyé une demande d’invitation.",
          target_url: `/profile/${user.id}`,
        });

        setFriendshipRecord(updatedFriendship as FriendshipRecord);
        setFriendshipStatus("pending");
        setLoadingFriend(false);
        toast.success("Demande d’ami renvoyée.");
        return;
      }

      setLoadingFriend(false);
      toast.info("Une relation existe déjà avec cet utilisateur.");
      return;
    }

    const { data: friendshipData, error } = await supabase
      .from("friendships")
      .insert({
        user_id: user.id,
        friend_id: userId,
        status: "pending",
      })
      .select("id, user_id, friend_id, status, created_at, updated_at")
      .maybeSingle();

    if (error) {
      setLoadingFriend(false);
      toast.error(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: userId,
      actor_id: user.id,
      friendship_id: friendshipData?.id ?? null,
      type: "friend_request",
      title: "Nouvelle demande d’ami",
      message: "vous a envoyé une demande d’invitation.",
      target_url: `/profile/${user.id}`,
    });

    setLoadingFriend(false);
    setFriendshipRecord(friendshipData as FriendshipRecord);
    setFriendshipStatus("pending");
    toast.success("Demande d’ami envoyée.");
  }

  async function removeFriend() {
    if (!friendshipRecord) {
      toast.error("Aucune relation à supprimer.");
      return;
    }

    const wasAccepted = friendshipStatus === "accepted";

    const confirmRemove = window.confirm(
      wasAccepted
        ? "Voulez-vous vraiment retirer cet ami ?"
        : "Voulez-vous annuler cette demande d’ami ?"
    );

    if (!confirmRemove) return;

    setLoadingFriend(true);

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipRecord.id);

    setLoadingFriend(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setFriendshipRecord(null);
    setFriendshipStatus("none");

    toast.success(wasAccepted ? "Ami retiré." : "Demande annulée.");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id]);

  function renderFriendButton() {
    if (user?.id === userId) {
      return <Button onClick={() => navigate("/settings")}>Éditer</Button>;
    }

    if (friendshipStatus === "pending") {
      const isMyRequest = friendshipRecord?.user_id === user?.id;

      if (isMyRequest) {
        return (
          <Button
            variant="outline"
            onClick={removeFriend}
            disabled={loadingFriend}
          >
            {loadingFriend ? "Annulation..." : "Annuler la demande"}
          </Button>
        );
      }

      return (
        <Button variant="secondary" onClick={() => navigate("/notifications")}>
          Répondre à la demande
        </Button>
      );
    }

    if (friendshipStatus === "accepted") {
      return (
        <Button
          variant="destructive"
          onClick={removeFriend}
          disabled={loadingFriend}
        >
          <UserMinus size={16} className="mr-2" />
          {loadingFriend ? "Suppression..." : "Retirer ami"}
        </Button>
      );
    }

    return (
      <Button onClick={addFriend} disabled={loadingFriend}>
        <UserPlus size={16} className="mr-2" />
        {loadingFriend ? "Envoi..." : "Ajouter ami"}
      </Button>
    );
  }

  const visibleFriends = showAllFriends ? friends : friends.slice(0, 5);
  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, 6);

  if (loadingProfile) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="glass-panel p-6 text-center text-sm text-muted-foreground">
          Chargement du profil...
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="glass-panel p-6 text-center">
          <h1 className="text-xl font-bold">Profil introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce profil n’existe pas ou le lien utilisé est incorrect.
          </p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Retour à l’accueil
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="glass-panel overflow-hidden p-0">
          <div className="h-36 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />

          <div className="-mt-12 flex flex-col gap-4 p-5 md:flex-row md:items-end">
            <Avatar
              src={profile.avatar_url}
              name={profile.full_name || profile.username}
              className="h-28 w-28 border-4 border-white text-lg dark:border-slate-950"
            />

            <div className="flex-1">
              <h1 className="text-2xl font-black">
                {profile.full_name || profile.username || "Utilisateur"}
              </h1>

              <p className="text-sm text-muted-foreground">
                @{profile.username || "profil"}
              </p>

              <p className="mt-2 max-w-2xl text-sm">
                {profile.bio || "Aucune bio pour le moment."}
              </p>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() =>
                    profile.location &&
                    window.open(
                      `https://www.google.com/maps/search/${encodeURIComponent(
                        profile.location
                      )}`,
                      "_blank"
                    )
                  }
                  className="hover:text-primary hover:underline"
                >
                  📍 {profile.location || "Non renseigné"}
                </button>

                {profile.website ? (
                  <a
                    href={
                      profile.website.startsWith("http")
                        ? profile.website
                        : `https://${profile.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    🌐 {profile.website}
                  </a>
                ) : (
                  <span>🌐 Aucun site</span>
                )}

                <a
                  href="#publications"
                  className="hover:text-primary hover:underline"
                >
                  📝 {posts.length} publications
                </a>

                <a href="#friends" className="hover:text-primary hover:underline">
                  👥 {friends.length} amis
                </a>

                <a href="#photos" className="hover:text-primary hover:underline">
                  🖼️ {photos.length} photos
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {renderFriendButton()}

              {user?.id !== userId && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/messages?user=${userId}`)}
                >
                  <MessageCircle size={16} className="mr-2" />
                  Message
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-4">
            <Card className="glass-panel p-4">
              <h2 className="mb-3 font-bold">À propos</h2>

              <div className="space-y-3 text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() =>
                    profile.location &&
                    window.open(
                      `https://www.google.com/maps/search/${encodeURIComponent(
                        profile.location
                      )}`,
                      "_blank"
                    )
                  }
                  className="flex items-center gap-2 hover:text-primary hover:underline"
                >
                  <MapPin size={16} />
                  {profile.location || "Localisation non renseignée"}
                </button>

                {profile.website ? (
                  <a
                    href={
                      profile.website.startsWith("http")
                        ? profile.website
                        : `https://${profile.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:text-primary hover:underline"
                  >
                    <Globe size={16} />
                    {profile.website}
                  </a>
                ) : (
                  <p className="flex items-center gap-2">
                    <Globe size={16} />
                    Site non renseigné
                  </p>
                )}

                <a
                  href="#publications"
                  className="flex items-center gap-2 hover:text-primary hover:underline"
                >
                  <FileText size={16} />
                  {posts.length} publications
                </a>

                <a
                  href="#friends"
                  className="flex items-center gap-2 hover:text-primary hover:underline"
                >
                  <Users size={16} />
                  {friends.length} amis
                </a>

                <a
                  href="#photos"
                  className="flex items-center gap-2 hover:text-primary hover:underline"
                >
                  <Image size={16} />
                  {photos.length} photos
                </a>
              </div>
            </Card>

            <Card id="friends" className="glass-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Amis</h2>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {friends.length}
                  </span>

                  {friends.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllFriends((value) => !value)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {showAllFriends ? "Réduire" : "Voir tous"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visibleFriends.map((friend) => (
                  <Link
                    key={friend.id}
                    to={`/profile/${friend.id}`}
                    className="rounded-2xl bg-muted/50 p-2 transition hover:bg-accent"
                  >
                    <Avatar
                      src={friend.avatar_url}
                      name={friend.full_name || friend.username}
                      className="h-12 w-12"
                    />

                    <p className="mt-2 truncate text-xs font-semibold">
                      {friend.full_name || friend.username || "Utilisateur"}
                    </p>
                  </Link>
                ))}

                {friends.length === 0 && (
                  <p className="col-span-full text-xs text-muted-foreground">
                    Aucun ami à afficher.
                  </p>
                )}
              </div>
            </Card>

            <Card id="photos" className="glass-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Photos</h2>

                <div className="flex items-center gap-2">
                  <Image size={16} />

                  {photos.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllPhotos((value) => !value)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {showAllPhotos ? "Réduire" : "Voir tous"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {visiblePhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedPhoto(photo.media_url)}
                    className="aspect-square overflow-hidden rounded-xl bg-muted transition hover:scale-[1.02]"
                  >
                    <img
                      src={photo.media_url}
                      alt="Photo"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}

                {photos.length === 0 && (
                  <p className="col-span-full text-xs text-muted-foreground">
                    Aucune photo publiée.
                  </p>
                )}
              </div>
            </Card>
          </aside>

          <section id="publications" className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onChange={refreshPostsOnly} />
            ))}

            {posts.length === 0 && (
              <Card className="glass-panel p-6 text-center text-sm text-muted-foreground">
                Aucune publication pour le moment.
              </Card>
            )}
          </section>
        </div>
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={22} />
          </button>

          <img
            src={selectedPhoto}
            alt="Photo agrandie"
            decoding="async"
            className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}