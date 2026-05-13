import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Phone, Video, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { timeAgo } from "@/lib/utils";

type ActorProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NotificationItem = {
  id: string;
  user_id: string;
  actor_id: string | null;
  friendship_id: string | null;
  type: string;
  title: string | null;
  message: string | null;
  target_url: string | null;
  is_read: boolean;
  created_at: string;
  actor?: ActorProfile | null;
};

const NOTIFICATION_SELECT =
  "id, user_id, actor_id, friendship_id, type, title, message, target_url, is_read, created_at";

function getNotificationText(notification: NotificationItem) {
  if (notification.message) return notification.message;

  if (notification.type === "friend_request") {
    return "vous a envoyé une demande d’invitation.";
  }

  if (notification.type === "friend_request_accepted") {
    return "a accepté votre demande d’invitation.";
  }

  if (notification.type === "friend_request_declined") {
    return "a refusé votre demande d’invitation.";
  }

  if (notification.type === "audio_call") {
    return "vous appelle en vocal.";
  }

  if (notification.type === "video_call") {
    return "vous appelle en vidéo.";
  }

  return "a une activité récente avec vous.";
}

function getNotificationTitle(notification: NotificationItem) {
  if (notification.title) return notification.title;

  if (notification.type === "friend_request") return "Demande d’ami";
  if (notification.type === "friend_request_accepted") return "Demande acceptée";
  if (notification.type === "friend_request_declined") return "Demande refusée";
  if (notification.type === "audio_call") return "Appel vocal";
  if (notification.type === "video_call") return "Appel vidéo";

  return "Notification";
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function getActors(actorIds: string[]) {
    if (actorIds.length === 0) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", actorIds);

    if (error) {
      console.error("Erreur chargement acteurs :", error.message);
      return [];
    }

    return ((data ?? []) as unknown) as ActorProfile[];
  }

  async function enrichNotifications(notifications: NotificationItem[]) {
    const actorIds = [
      ...new Set(
        notifications
          .map((notification) => notification.actor_id)
          .filter(Boolean) as string[]
      ),
    ];

    const actors = await getActors(actorIds);

    return notifications.map((notification) => ({
      ...notification,
      actor:
        actors.find((actor) => actor.id === notification.actor_id) ?? null,
    }));
  }

  async function markAsRead(notifications: NotificationItem[]) {
    if (!user) return;

    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    setItems((previousItems) =>
      previousItems.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, is_read: true }
          : notification
      )
    );

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erreur lecture notifications :", error.message);
    }
  }

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const notifications = ((data ?? []) as unknown) as NotificationItem[];
    const withActors = await enrichNotifications(notifications);

    setItems(withActors);
    await markAsRead(withActors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function addOrUpdateNotification(notification: NotificationItem) {
    const enriched = await enrichNotifications([notification]);
    const nextNotification = enriched[0];

    setItems((previousItems) => {
      const exists = previousItems.some((item) => item.id === notification.id);

      if (exists) {
        return previousItems.map((item) =>
          item.id === notification.id ? { ...item, ...nextNotification } : item
        );
      }

      return [nextNotification, ...previousItems].slice(0, 50);
    });

    if (!notification.is_read) {
      await markAsRead([notification]);
    }
  }

  async function respondToFriendRequest(
    notification: NotificationItem,
    decision: "accepted" | "declined"
  ) {
    if (!user || !notification.friendship_id || !notification.actor_id) {
      toast.error("Demande invalide.");
      return;
    }

    if (loadingAction) return;

    setLoadingAction(notification.id);

    const { error: updateError } = await supabase
      .from("friendships")
      .update({
        status: decision,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notification.friendship_id);

    if (updateError) {
      setLoadingAction(null);
      toast.error(updateError.message);
      return;
    }

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: notification.actor_id,
      actor_id: user.id,
      friendship_id: notification.friendship_id,
      type:
        decision === "accepted"
          ? "friend_request_accepted"
          : "friend_request_declined",
      title: decision === "accepted" ? "Demande acceptée" : "Demande refusée",
      message:
        decision === "accepted"
          ? "a accepté votre demande d’invitation."
          : "a refusé votre demande d’invitation.",
      target_url: `/profile/${user.id}`,
      is_read: false,
    });

    if (insertError) {
      console.error("Erreur notification réponse :", insertError.message);
    }

    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notification.id);

    setLoadingAction(null);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    setItems((previousItems) =>
      previousItems.filter((item) => item.id !== notification.id)
    );

    toast.success(
      decision === "accepted" ? "Demande acceptée." : "Demande refusée."
    );
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationItem;
          void addOrUpdateNotification(notification);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationItem;
          void addOrUpdateNotification(notification);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deletedNotification = payload.old as NotificationItem;

          setItems((previousItems) =>
            previousItems.filter(
              (notification) => notification.id !== deletedNotification.id
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="glass-panel p-5">
        <h1 className="text-2xl font-black">Notifications</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Invitations, messages, appels et activités importantes.
        </p>
      </Card>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="glass-panel p-4">
              <div className="flex animate-pulse gap-3">
                <div className="h-11 w-11 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading &&
        items.map((notification) => {
          const actorName =
            notification.actor?.full_name ||
            notification.actor?.username ||
            "Utilisateur";

          const actorUrl =
            notification.target_url ||
            (notification.actor_id ? `/profile/${notification.actor_id}` : "#");

          const isCall =
            notification.type === "audio_call" ||
            notification.type === "video_call";

          return (
            <Card key={notification.id} className="glass-panel p-4">
              <div className="flex gap-3">
                <Link to={actorUrl}>
                  <Avatar
                    src={notification.actor?.avatar_url || undefined}
                    name={actorName}
                    className="h-11 w-11"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link to={actorUrl} className="font-bold hover:underline">
                      {actorName}
                    </Link>{" "}
                    {getNotificationText(notification)}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {getNotificationTitle(notification)} ·{" "}
                    {timeAgo(notification.created_at)}
                  </p>

                  {notification.type === "friend_request" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={loadingAction === notification.id}
                        onClick={() =>
                          respondToFriendRequest(notification, "accepted")
                        }
                      >
                        <Check size={15} className="mr-1" />
                        {loadingAction === notification.id
                          ? "..."
                          : "Accepter"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingAction === notification.id}
                        onClick={() =>
                          respondToFriendRequest(notification, "declined")
                        }
                      >
                        <X size={15} className="mr-1" />
                        Refuser
                      </Button>
                    </div>
                  )}

                  {isCall && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => {
                          if (actorUrl !== "#") {
                            navigate(actorUrl);
                          }
                        }}
                      >
                        {notification.type === "audio_call" ? (
                          <Phone size={15} className="mr-1" />
                        ) : (
                          <Video size={15} className="mr-1" />
                        )}
                        Répondre
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

      {!loading && items.length === 0 && (
        <Card className="glass-panel p-8 text-center text-sm text-muted-foreground">
          Aucune notification pour le moment.
        </Card>
      )}
    </div>
  );
}