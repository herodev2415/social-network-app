import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Home,
  Moon,
  Search,
  Sun,
  Users,
  MessageCircle,
  Phone,
  Menu,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/db/supabase";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
    }
  }

  async function loadUnreadMessagesCount() {
    if (!user) {
      setUnreadMessagesCount(0);
      return;
    }

    const { data: participants, error: participantError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (participantError) {
      console.error("Erreur chargement conversations :", participantError.message);
      setUnreadMessagesCount(0);
      return;
    }

    const conversationIds = [
      ...new Set(
        (participants ?? []).map((item) => item.conversation_id as string)
      ),
    ];

    if (conversationIds.length === 0) {
      setUnreadMessagesCount(0);
      return;
    }

    const { data: unreadMessages, error } = await supabase
      .from("messages")
      .select("sender_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Erreur messages non lus :", error.message);
      setUnreadMessagesCount(0);
      return;
    }

    const uniqueSenders = new Set(
      (unreadMessages ?? []).map((message) => message.sender_id)
    );

    setUnreadMessagesCount(uniqueSenders.size);
  }

  useEffect(() => {
    loadUnreadMessagesCount();

    if (!user) return;

    const channel = supabase
      .channel(`navbar-unread-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          loadUnreadMessagesCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const nav = [
    { to: "/", icon: Home, label: "Accueil" },
    { to: "/groups", icon: Users, label: "Groupes" },
    { to: "/messages", icon: MessageCircle, label: "Messages" },
    { to: "/calls", icon: Phone, label: "Appels" },
    { to: "/notifications", icon: Bell, label: "Alertes" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 md:px-5">
        <Link to="/" className="group flex items-center gap-2">
          <div className="gradient-brand grid h-10 w-10 place-items-center rounded-2xl text-white shadow-lg shadow-primary/25 transition group-hover:scale-105">
            <Sparkles size={20} />
          </div>

          <div className="hidden leading-tight md:block">
            <div className="text-sm font-black tracking-tight gradient-text">
              Social Connect
            </div>
            <div className="text-[11px] text-muted-foreground">
              Connecte. Partage. Explore.
            </div>
          </div>
        </Link>

        <form
          onSubmit={(event) => {
            event.preventDefault();

            const query = String(
              new FormData(event.currentTarget).get("q") ?? ""
            ).trim();

            if (query) {
              navigate(`/search?q=${encodeURIComponent(query)}`);
            }
          }}
          className="relative ml-1 hidden max-w-md flex-1 md:block"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />

          <Input
            name="q"
            placeholder="Rechercher un profil, un groupe, une idée..."
            className="h-10 rounded-2xl border-transparent bg-muted/70 pl-10"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const isMessages = item.label === "Messages";

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative flex h-10 min-w-10 items-center justify-center rounded-2xl px-3 text-sm transition ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`
                }
                title={item.label}
              >
                <div className="relative">
                  <item.icon size={18} />

                  {isMessages && unreadMessagesCount > 0 && (
                    <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
                    </span>
                  )}
                </div>

                <span className="ml-2 hidden font-semibold lg:inline">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title="Changer le thème"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <Link to="/profile/me">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name || profile?.username || "Utilisateur"}
          />
        </Link>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="hidden md:inline-flex"
        >
          Sortir
        </Button>

        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu size={18} />
        </Button>
      </div>

      <nav className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-3xl border border-white/60 bg-white/90 p-1 shadow-2xl backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/90">
        {nav.slice(0, 4).map((item) => {
          const isMessages = item.label === "Messages";

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative grid h-11 w-12 place-items-center rounded-2xl ${
                  isActive
                    ? "gradient-brand text-white"
                    : "text-muted-foreground"
                }`
              }
            >
              <item.icon size={19} />

              {isMessages && unreadMessagesCount > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}