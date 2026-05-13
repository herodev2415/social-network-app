import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Phone, Video, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { timeAgo } from "@/lib/utils";

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
  actor?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function load() {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    const notifications = (data as NotificationItem[]) ?? [];

    const actorIds = [
      ...new Set(
        notifications
          .map((item) => item.actor_id)
          .filter(Boolean) as string[]
      ),
    ];

    let actors: any[] = [];

    if (actorIds.length > 0) {
      const { data: actorData, error: actorError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", actorIds);

      if (actorError) {
        console.error(actorError.message);
      } else {
        actors = actorData ?? [];
      }
    }

    const withActors = notifications.map((item) => ({
      ...item,
      actor: actors.find((actor) => actor.id === item.actor_id) ?? null,
    }));

    setItems(withActors);

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
  }

  async function respondToFriendRequest(
    notification: NotificationItem,
    decision: "accepted" | "declined"
  ) {
    if (!user || !notification.friendship_id || !notification.actor_id) {
      toast.error("Demande invalide.");
      return;
    }

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

    await supabase.from("notifications").insert({
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
    });

    await supabase.from("notifications").delete().eq("id", notification.id);

    setLoadingAction(null);

    toast.success(
      decision === "accepted" ? "Demande acceptée." : "Demande refusée."
    );

    await load();
  }

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
    if (notification.type === "friend_request_accepted")
      return "Demande acceptée";
    if (notification.type === "friend_request_declined")
      return "Demande refusée";
    if (notification.type === "audio_call") return "Appel vocal";
    if (notification.type === "video_call") return "Appel vidéo";

    return "Notification";
  }

  useEffect(() => {
    load();

    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

      {items.map((notification) => {
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
                  src={notification.actor?.avatar_url}
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
                      Accepter
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
                      onClick={() => navigate(actorUrl)}
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

      {items.length === 0 && (
        <Card className="glass-panel p-8 text-center text-sm text-muted-foreground">
          Aucune notification pour le moment.
        </Card>
      )}
    </div>
  );
}