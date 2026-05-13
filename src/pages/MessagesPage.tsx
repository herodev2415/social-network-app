import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  File as FileIcon,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Phone,
  Send,
  Square,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { timeAgo } from "@/lib/utils";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  media_url?: string | null;
  media_type?: "text" | "image" | "file" | "audio" | null;
  file_name?: string | null;
};

type ProfileMini = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type ConversationItem = {
  id: string;
  updated_at: string | null;
  other: ProfileMini | null;
  unread_count: number;
};

const MESSAGE_SELECT =
  "id, conversation_id, sender_id, content, created_at, is_read, media_url, media_type, file_name";

const MAX_MESSAGE_FILE_SIZE = 25 * 1024 * 1024;

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function getMediaType(file: File): "image" | "audio" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function makeTempMessage(params: {
  conversationId: string;
  userId: string;
  content: string;
  mediaType: "text" | "image" | "file" | "audio";
  mediaUrl?: string | null;
  fileName?: string | null;
}): Message {
  return {
    id: `temp-${crypto.randomUUID()}`,
    conversation_id: params.conversationId,
    sender_id: params.userId,
    content: params.content,
    created_at: new Date().toISOString(),
    is_read: false,
    media_url: params.mediaUrl ?? null,
    media_type: params.mediaType,
    file_name: params.fileName ?? null,
  };
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const targetUserId = searchParams.get("user");

  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileMini | null>(
    null
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedName =
    selectedProfile?.full_name ||
    selectedProfile?.username ||
    "Conversation";

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function mergeMessage(nextMessage: Message) {
    setMessages((previousMessages) => {
      const exists = previousMessages.some(
        (message) => message.id === nextMessage.id
      );

      if (exists) {
        return previousMessages.map((message) =>
          message.id === nextMessage.id ? nextMessage : message
        );
      }

      return [...previousMessages, nextMessage].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    scrollToBottom();
  }

  async function getProfileById(profileId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      return null;
    }

    return (data as ProfileMini) ?? null;
  }

  const loadConversations = useCallback(async () => {
    if (!user || loadingConversations) return;

    setLoadingConversations(true);

    const { data: myParticipants, error: participantError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (participantError) {
      setLoadingConversations(false);
      toast.error(participantError.message);
      return;
    }

    const conversationIds = [
      ...new Set(
        (myParticipants ?? []).map((item) => String(item.conversation_id))
      ),
    ];

    if (conversationIds.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    const [
      conversationResult,
      otherParticipantsResult,
      unreadMessagesResult,
    ] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, updated_at, created_at")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false }),

      supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds)
        .neq("user_id", user.id),

      supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
        .eq("is_read", false),
    ]);

    if (conversationResult.error) {
      setLoadingConversations(false);
      toast.error(conversationResult.error.message);
      return;
    }

    if (otherParticipantsResult.error) {
      setLoadingConversations(false);
      toast.error(otherParticipantsResult.error.message);
      return;
    }

    if (unreadMessagesResult.error) {
      console.error(
        "Erreur messages non lus :",
        unreadMessagesResult.error.message
      );
    }

    const otherParticipants = otherParticipantsResult.data ?? [];
    const otherUserIds = [
      ...new Set(otherParticipants.map((item) => String(item.user_id))),
    ];

    let profiles: ProfileMini[] = [];

    if (otherUserIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", otherUserIds);

      if (profileError) {
        setLoadingConversations(false);
        toast.error(profileError.message);
        return;
      }

      profiles = ((profileData ?? []) as unknown) as ProfileMini[];
    }

    const unreadByConversation: Record<string, number> = {};

    for (const message of unreadMessagesResult.data ?? []) {
      const id = String(message.conversation_id);
      unreadByConversation[id] = (unreadByConversation[id] ?? 0) + 1;
    }

    const rawConversations: ConversationItem[] = (
      conversationResult.data ?? []
    ).map((conversation) => {
      const otherParticipant = otherParticipants.find(
        (item) => item.conversation_id === conversation.id
      );

      const otherProfile =
        profiles.find((profile) => profile.id === otherParticipant?.user_id) ??
        null;

      return {
        id: String(conversation.id),
        updated_at:
          String(conversation.updated_at || conversation.created_at) || null,
        other: otherProfile,
        unread_count: unreadByConversation[String(conversation.id)] ?? 0,
      };
    });

    const uniqueByPerson = new Map<string, ConversationItem>();

    for (const conversation of rawConversations) {
      const key = conversation.other?.id || conversation.id;
      const existing = uniqueByPerson.get(key);

      if (!existing) {
        uniqueByPerson.set(key, conversation);
        continue;
      }

      const existingDate = existing.updated_at
        ? new Date(existing.updated_at).getTime()
        : 0;

      const currentDate = conversation.updated_at
        ? new Date(conversation.updated_at).getTime()
        : 0;

      if (currentDate > existingDate) {
        uniqueByPerson.set(key, {
          ...conversation,
          unread_count:
            conversation.unread_count + (existing.unread_count ?? 0),
        });
      } else {
        uniqueByPerson.set(key, {
          ...existing,
          unread_count:
            existing.unread_count + (conversation.unread_count ?? 0),
        });
      }
    }

    setConversations(
      Array.from(uniqueByPerson.values()).sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() -
          new Date(a.updated_at ?? 0).getTime()
      )
    );

    setLoadingConversations(false);
  }, [user, loadingConversations]);

  const loadMessages = useCallback(async () => {
    if (!conversationId || !user) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(80);

    setLoadingMessages(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const nextMessages = (((data ?? []) as unknown) as Message[]).reverse();

    setMessages(nextMessages);
    scrollToBottom();

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id);

    setConversations((previousConversations) =>
      previousConversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )
    );
  }, [conversationId, user]);

  async function openConversation(conversation: ConversationItem) {
    setConversationId(conversation.id);
    setSelectedProfile(conversation.other);

    setConversations((previousConversations) =>
      previousConversations.map((item) =>
        item.id === conversation.id ? { ...item, unread_count: 0 } : item
      )
    );

    if (user) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", user.id);
    }
  }

  async function openOrCreateConversationWith(targetId: string) {
    if (!user) return;

    if (targetId === user.id) {
      toast.error("Vous ne pouvez pas vous envoyer un message à vous-même.");
      return;
    }

    const targetProfile = await getProfileById(targetId);
    setSelectedProfile(targetProfile);

    const { data: myParticipants, error: myError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myError) {
      toast.error(myError.message);
      return;
    }

    const myConversationIds = [
      ...new Set(
        (myParticipants ?? []).map((item) => String(item.conversation_id))
      ),
    ];

    if (myConversationIds.length > 0) {
      const { data: existingConversations, error: existingError } =
        await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .in("conversation_id", myConversationIds)
          .eq("user_id", targetId)
          .limit(1);

      if (existingError) {
        toast.error(existingError.message);
        return;
      }

      if (existingConversations && existingConversations.length > 0) {
        const existingConversationId = String(
          existingConversations[0].conversation_id
        );

        setConversationId(existingConversationId);

        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", existingConversationId)
          .neq("sender_id", user.id);

        await loadConversations();
        return;
      }
    }

    const newConversationId = crypto.randomUUID();

    const { error: conversationError } = await supabase
      .from("conversations")
      .insert({
        id: newConversationId,
        updated_at: new Date().toISOString(),
      });

    if (conversationError) {
      toast.error(conversationError.message);
      return;
    }

    const { error: participantsError } = await supabase
      .from("conversation_participants")
      .insert([
        {
          conversation_id: newConversationId,
          user_id: user.id,
        },
        {
          conversation_id: newConversationId,
          user_id: targetId,
        },
      ]);

    if (participantsError) {
      toast.error(participantsError.message);
      return;
    }

    setConversationId(newConversationId);

    setConversations((previousConversations) => [
      {
        id: newConversationId,
        updated_at: new Date().toISOString(),
        other: targetProfile,
        unread_count: 0,
      },
      ...previousConversations,
    ]);
  }

  async function updateConversationTime(targetConversationId = conversationId) {
    if (!targetConversationId) return;

    const updatedAt = new Date().toISOString();

    await supabase
      .from("conversations")
      .update({
        updated_at: updatedAt,
      })
      .eq("id", targetConversationId);

    setConversations((previousConversations) =>
      previousConversations
        .map((conversation) =>
          conversation.id === targetConversationId
            ? { ...conversation, updated_at: updatedAt }
            : conversation
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at ?? 0).getTime() -
            new Date(a.updated_at ?? 0).getTime()
        )
    );
  }

  async function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const messageContent = content.trim();

    if (!user || !conversationId || !messageContent || sending) return;

    const tempMessage = makeTempMessage({
      conversationId,
      userId: user.id,
      content: messageContent,
      mediaType: "text",
    });

    setSending(true);
    setContent("");
    mergeMessage(tempMessage);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: messageContent,
        media_type: "text",
        is_read: false,
      })
      .select(MESSAGE_SELECT)
      .single();

    setSending(false);

    if (error) {
      setMessages((previousMessages) =>
        previousMessages.filter((message) => message.id !== tempMessage.id)
      );
      setContent(messageContent);
      toast.error(error.message);
      return;
    }

    if (data) {
      const savedMessage = ((data as unknown) as Message);

      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          message.id === tempMessage.id ? savedMessage : message
        )
      );
    }

    await updateConversationTime();
  }

  async function uploadAndSendFile(file: File) {
    if (!user || !conversationId || sending) return;

    if (file.size > MAX_MESSAGE_FILE_SIZE) {
      toast.error("Le fichier ne doit pas dépasser 25 Mo.");
      return;
    }

    setSending(true);

    const safeName = cleanFileName(file.name);
    const path = `messages/${conversationId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setSending(false);
      toast.error(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("media")
      .getPublicUrl(path);

    const mediaType = getMediaType(file);
    const messageContent =
      mediaType === "image"
        ? "Photo"
        : mediaType === "audio"
        ? "Message vocal"
        : file.name;

    const tempMessage = makeTempMessage({
      conversationId,
      userId: user.id,
      content: messageContent,
      mediaType,
      mediaUrl: publicUrlData.publicUrl,
      fileName: file.name,
    });

    mergeMessage(tempMessage);

    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: messageContent,
        media_url: publicUrlData.publicUrl,
        media_type: mediaType,
        file_name: file.name,
        is_read: false,
      })
      .select(MESSAGE_SELECT)
      .single();

    setSending(false);

    if (insertError) {
      setMessages((previousMessages) =>
        previousMessages.filter((message) => message.id !== tempMessage.id)
      );
      toast.error(insertError.message);
      return;
    }

    if (data) {
      const savedMessage = ((data as unknown) as Message);

      setMessages((previousMessages) =>
        previousMessages.map((message) =>
          message.id === tempMessage.id ? savedMessage : message
        )
      );
    }

    await updateConversationTime();
  }

  async function startRecording() {
    if (!conversationId) {
      toast.error("Sélectionne une conversation.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("L’enregistrement vocal n’est pas supporté par ce navigateur.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        const audioFile = new File(
          [blob],
          `message-vocal-${Date.now()}.webm`,
          {
            type: "audio/webm",
          }
        );

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        await uploadAndSendFile(audioFile);
      };

      recorder.start();
      setRecording(true);
      toast.success("Enregistrement vocal démarré.");
    } catch {
      toast.error("Micro refusé ou indisponible.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    toast.success("Enregistrement vocal arrêté.");
  }

  async function startCall(type: "audio" | "video") {
    if (!user || !selectedProfile) {
      toast.error("Sélectionne une conversation.");
      return;
    }

    const notificationText =
      type === "audio" ? "vous appelle en vocal." : "vous appelle en vidéo.";

    const { error } = await supabase.from("notifications").insert({
      user_id: selectedProfile.id,
      actor_id: user.id,
      type: type === "audio" ? "audio_call" : "video_call",
      title: type === "audio" ? "Appel vocal" : "Appel vidéo",
      message: notificationText,
      target_url: `/messages?user=${user.id}`,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      type === "audio"
        ? "Invitation d’appel vocal envoyée."
        : "Invitation d’appel vidéo envoyée."
    );
  }

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (targetUserId && user) {
      void openOrCreateConversationWith(targetUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, user?.id]);

  useEffect(() => {
    void loadMessages();

    if (!conversationId || !user) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          if (!newMessage?.id) return;

          mergeMessage(newMessage);

          if (newMessage.sender_id !== user.id) {
            await supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMessage.id);
          }

          void updateConversationTime(newMessage.conversation_id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === updatedMessage.id ? updatedMessage : message
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedMessage = payload.old as Message;

          setMessages((previousMessages) =>
            previousMessages.filter(
              (message) => message.id !== deletedMessage.id
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`conversation-participants-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadConversations();
        }
      )
      .subscribe();

    const refreshOnFocus = () => {
      void loadConversations();
    };

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="grid gap-3 md:grid-cols-[320px_1fr]">
      <Card className="glass-panel p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Conversations</h2>

          {loadingConversations && (
            <span className="text-[11px] text-muted-foreground">
              Chargement...
            </span>
          )}
        </div>

        <div className="space-y-2">
          {conversations.map((conversation) => {
            const otherName =
              conversation.other?.full_name ||
              conversation.other?.username ||
              "Utilisateur";

            const isActive = conversation.id === conversationId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => openConversation(conversation)}
                className={`relative flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
                }`}
              >
                <Avatar
                  src={conversation.other?.avatar_url || undefined}
                  name={otherName}
                  className="h-10 w-10"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{otherName}</p>

                  <p className="text-xs text-muted-foreground">
                    {conversation.updated_at
                      ? timeAgo(conversation.updated_at)
                      : "Conversation"}
                  </p>
                </div>

                {conversation.unread_count > 0 && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-white">
                    {conversation.unread_count}
                  </span>
                )}
              </button>
            );
          })}

          {conversations.length === 0 && !loadingConversations && (
            <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
              Aucune conversation pour le moment. Va sur le profil d’un
              utilisateur puis clique sur “Message”.
            </div>
          )}
        </div>
      </Card>

      <Card className="glass-panel flex min-h-[70vh] flex-col p-0">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            {selectedProfile ? (
              <>
                <Link to={`/profile/${selectedProfile.id}`}>
                  <Avatar
                    src={selectedProfile.avatar_url || undefined}
                    name={selectedName}
                    className="h-11 w-11"
                  />
                </Link>

                <div>
                  <Link
                    to={`/profile/${selectedProfile.id}`}
                    className="font-bold hover:underline"
                  >
                    {selectedName}
                  </Link>

                  <p className="text-xs text-muted-foreground">
                    Message privé sécurisé
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle size={20} />
                </div>

                <div>
                  <p className="font-bold">Messages</p>
                  <p className="text-xs text-muted-foreground">
                    Sélectionne une conversation.
                  </p>
                </div>
              </>
            )}
          </div>

          {selectedProfile && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => startCall("audio")}
                title="Appel vocal"
              >
                <Phone size={18} />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => startCall("video")}
                title="Appel vidéo"
              >
                <Video size={18} />
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loadingMessages && (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex animate-pulse justify-start">
                  <div className="h-10 w-2/3 rounded-2xl bg-muted" />
                </div>
              ))}
            </div>
          )}

          {!loadingMessages &&
            messages.map((message) => {
              const isMine = message.sender_id === user?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.media_type === "image" && message.media_url && (
                      <a
                        href={message.media_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={message.media_url}
                          alt={message.file_name || "Image"}
                          loading="lazy"
                          decoding="async"
                          className="mb-2 max-h-80 rounded-xl object-contain"
                        />
                      </a>
                    )}

                    {message.media_type === "audio" && message.media_url && (
                      <audio
                        controls
                        src={message.media_url}
                        preload="metadata"
                        className="mb-2"
                      />
                    )}

                    {message.media_type === "file" && message.media_url && (
                      <a
                        href={message.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-2 flex items-center gap-2 underline"
                      >
                        <FileIcon size={16} />
                        {message.file_name || "Fichier"}
                      </a>
                    )}

                    {message.content && (
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    )}

                    <div className="mt-1 text-[10px] opacity-70">
                      {timeAgo(message.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}

          {!conversationId && (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Ouvre une conversation pour commencer à discuter.
            </div>
          )}

          {conversationId && !loadingMessages && messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Aucun message pour le moment. Écris le premier message.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={sendText}
          className="flex items-center gap-2 border-t p-3"
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadAndSendFile(file);
              }

              event.currentTarget.value = "";
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadAndSendFile(file);
              }

              event.currentTarget.value = "";
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!conversationId || sending}
            onClick={() => imageInputRef.current?.click()}
            title="Envoyer une photo"
          >
            <ImageIcon size={18} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!conversationId || sending}
            onClick={() => fileInputRef.current?.click()}
            title="Envoyer un fichier"
          >
            <FileIcon size={18} />
          </Button>

          <Button
            type="button"
            variant={recording ? "destructive" : "ghost"}
            size="icon"
            disabled={!conversationId || sending}
            onClick={recording ? stopRecording : startRecording}
            title={recording ? "Arrêter le vocal" : "Message vocal"}
          >
            {recording ? <Square size={16} /> : <Mic size={18} />}
          </Button>

          <Input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              conversationId
                ? "Écrire un message..."
                : "Sélectionne une conversation..."
            }
            disabled={!conversationId || sending}
          />

          <Button
            type="submit"
            disabled={!conversationId || sending || !content.trim()}
          >
            <Send size={16} />
          </Button>
        </form>
      </Card>
    </div>
  );
}