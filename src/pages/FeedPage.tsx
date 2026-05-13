import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  TrendingUp,
  Users,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Newspaper,
  RefreshCcw,
} from "lucide-react";
import { supabase } from "@/db/supabase";
import type { Post, Story } from "@/types/types";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreatePostForm } from "@/components/CreatePostForm";
import { PostCard } from "@/components/PostCard";
import { StoryItem } from "@/components/StoryItem";
import { Avatar } from "@/components/ui/avatar";

type NewsPost = {
  id: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string;
  image_url: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
};

type FeedItem =
  | {
      type: "post";
      id: string;
      date: string;
      post: Post;
    }
  | {
      type: "news";
      id: string;
      date: string;
      news: NewsPost;
    };

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function FeedPage() {
  const { user, profile } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  async function loadPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles(*)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Erreur chargement publications :", error.message);
      setPosts([]);
      return;
    }

    const enriched = await Promise.all(
      ((data as Post[]) ?? []).map(async (p) => {
        const [{ count: likes }, { count: comments }, { data: liked }] =
          await Promise.all([
            supabase
              .from("likes")
              .select("*", { count: "exact", head: true })
              .eq("post_id", p.id),

            supabase
              .from("comments")
              .select("*", { count: "exact", head: true })
              .eq("post_id", p.id),

            user
              ? supabase
                  .from("likes")
                  .select("id")
                  .eq("post_id", p.id)
                  .eq("user_id", user.id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        return {
          ...p,
          likes_count: likes ?? 0,
          comments_count: comments ?? 0,
          liked_by_me: !!liked,
        };
      })
    );

    setPosts(enriched);
  }

  async function loadNewsPosts() {
    const { data, error } = await supabase
      .from("news_posts")
      .select(
        `
        id,
        title,
        summary,
        source_name,
        source_url,
        image_url,
        category,
        published_at,
        created_at
      `
      )
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error("Erreur chargement actualités :", error.message);
      setNewsPosts([]);
      return;
    }

    setNewsPosts((data as NewsPost[]) ?? []);
  }

  async function loadStories() {
    const { data, error } = await supabase
      .from("stories")
      .select("*, profiles(*)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement stories :", error.message);
      setStories([]);
      return;
    }

    setStories((data as Story[]) ?? []);
  }

  async function loadFeed() {
    setLoading(true);

    await Promise.all([loadPosts(), loadStories(), loadNewsPosts()]);

    setLoading(false);
  }

  useEffect(() => {
    loadFeed();

    const ch = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        loadFeed
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes" },
        loadPosts
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        loadPosts
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        loadStories
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "news_posts" },
        loadNewsPosts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [limit, user?.id]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const mappedPosts: FeedItem[] = posts.map((post) => ({
      type: "post",
      id: `post-${post.id}`,
      date: post.created_at,
      post,
    }));

    const mappedNews: FeedItem[] = newsPosts.map((news) => ({
      type: "news",
      id: `news-${news.id}`,
      date: news.published_at ?? news.created_at,
      news,
    }));

    return [...mappedPosts, ...mappedNews].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [posts, newsPosts]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_310px]">
      <aside className="hidden lg:block">
        <Card className="glass-panel sticky top-24 overflow-hidden p-4">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500 p-4 text-white">
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name || profile?.username}
              className="h-14 w-14 border-2 border-white/40"
            />

            <h2 className="mt-3 font-black">
              {profile?.full_name || profile?.username || "Bienvenue"}
            </h2>

            <p className="text-xs text-white/80">
              Prêt à partager quelque chose ?
            </p>
          </div>

          <nav className="mt-4 space-y-1 text-sm">
            <a
              href="/profile/me"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <Users size={17} /> Mon profil
            </a>

            <a
              href="/groups"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <Sparkles size={17} /> Groupes
            </a>

            <a
              href="/messages"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <MessageCircle size={17} /> Messages
            </a>

            <a
              href="/settings"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <ShieldCheck size={17} /> Paramètres
            </a>
          </nav>
        </Card>
      </aside>

      <section className="mx-auto w-full max-w-2xl space-y-4">
        <Card className="glass-panel overflow-hidden p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-tight md:text-2xl">
                Fil d’actualité
              </h1>

              <p className="text-sm text-muted-foreground">
                Publications, vraies actualités, tendances et contenus récents.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadFeed}
                disabled={loading}
                className="hidden rounded-xl sm:inline-flex"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Actualiser
              </Button>

              <div className="icon-pill h-10 w-10">
                <TrendingUp size={19} />
              </div>
            </div>
          </div>

          <div className="custom-scrollbar flex gap-3 overflow-x-auto pb-1">
            <button className="w-20 shrink-0 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-dashed border-primary/40 bg-primary/10 text-primary">
                <Plus size={20} />
              </div>
              <div className="mt-1 text-[11px] font-semibold">Ajouter</div>
            </button>

            {stories.map((s) => (
              <StoryItem key={s.id} story={s} />
            ))}
          </div>
        </Card>

        <CreatePostForm onCreated={loadFeed} />

        {loading ? (
          <div className="space-y-4">
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </div>
        ) : feedItems.length === 0 ? (
          <Card className="glass-panel p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-primary/10 text-primary">
              <Sparkles />
            </div>

            <h2 className="mt-3 font-bold">
              Aucune publication pour le moment
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Publie quelque chose ou ajoute des actualités pour lancer le fil.
            </p>
          </Card>
        ) : (
          feedItems.map((item) => {
            if (item.type === "news") {
              return <NewsCard key={item.id} news={item.news} />;
            }

            return (
              <PostCard key={item.id} post={item.post} onChange={loadFeed} />
            );
          })
        )}

        {feedItems.length > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLimit((v) => v + 10)}
          >
            Voir plus de publications
          </Button>
        )}
      </section>

      <aside className="hidden xl:block">
        <Card className="glass-panel sticky top-24 space-y-4 p-4">
          <div>
            <h3 className="section-title">Suggestions</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Recherche des utilisateurs pour agrandir ton réseau.
            </p>
          </div>

          <div className="rounded-2xl bg-muted/60 p-3">
            <h3 className="section-title">Contacts en ligne</h3>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {profile?.username || "Vous"}
            </div>
          </div>

          <div className="rounded-2xl bg-primary/10 p-3 text-sm text-primary">
            <b>Astuce :</b> une interface propre garde l’utilisateur plus
            longtemps.
          </div>

          <div className="rounded-2xl border bg-background/70 p-3 text-sm">
            <div className="flex items-center gap-2 font-bold">
              <Newspaper className="h-4 w-4 text-primary" />
              Actualités officielles
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Le fil peut afficher des actualités récentes même quand peu
              d’utilisateurs publient.
            </p>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function NewsCard({ news }: { news: NewsPost }) {
  const displayDate = news.published_at ?? news.created_at;

  return (
    <Card className="glass-panel overflow-hidden">
      {news.image_url ? (
        <img
          src={news.image_url}
          alt={news.title}
          className="max-h-[360px] w-full object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            <Newspaper className="mr-1 h-3.5 w-3.5" />
            Actualité
          </span>

          {news.category ? (
            <span className="rounded-full bg-muted px-2.5 py-1">
              {news.category}
            </span>
          ) : null}

          <span>{formatDate(displayDate)}</span>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-black leading-snug">{news.title}</h2>

          {news.summary ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {news.summary}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Source :{" "}
            <span className="font-semibold text-foreground">
              {news.source_name ?? "Source externe"}
            </span>
          </p>

          <a
            href={news.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-accent"
          >
            Lire l’article
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Card>
  );
}

function FeedSkeleton() {
  return (
    <Card className="glass-panel p-4">
      <div className="space-y-3">
        <div className="h-4 w-1/3 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
        <div className="h-56 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    </Card>
  );
}