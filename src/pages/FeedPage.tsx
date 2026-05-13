import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import type { Story } from "@/types/types";
import { useAuth } from "@/contexts/AuthContext";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreatePostForm } from "@/components/CreatePostForm";
import { PostCard } from "@/components/PostCard";
import { StoryItem } from "@/components/StoryItem";
import { Avatar } from "@/components/ui/avatar";

const PAGE_SIZE = 10;
const NEWS_LIMIT = 6;
const STORIES_LIMIT = 16;

const FEED_CACHE_KEY = "social-connect-feed-cache-v4";
const FEED_CACHE_MAX_AGE = 5 * 60 * 1000;

type FeedPostProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type FeedPost = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "text" | string | null;
  created_at: string;
  comments_count?: number;
  profiles?: FeedPostProfile | null;
};

type FeedPostRpcRow = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  comments_count: number | string | null;
  profile_id: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NewsPost = {
  id: string;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
};

type FeedCache = {
  savedAt: number;
  posts: FeedPost[];
  stories: Story[];
  newsPosts: NewsPost[];
};

type FeedItem =
  | {
      type: "post";
      id: string;
      date: string;
      post: FeedPost;
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

function readFeedCache(): FeedCache | null {
  try {
    const rawCache = localStorage.getItem(FEED_CACHE_KEY);

    if (!rawCache) return null;

    const parsed = JSON.parse(rawCache) as FeedCache;

    if (!parsed?.savedAt) return null;

    const isFresh = Date.now() - parsed.savedAt < FEED_CACHE_MAX_AGE;

    if (!isFresh) return parsed;

    return parsed;
  } catch {
    localStorage.removeItem(FEED_CACHE_KEY);
    return null;
  }
}

function saveFeedCache(params: {
  posts: FeedPost[];
  stories: Story[];
  newsPosts: NewsPost[];
}) {
  try {
    const payload: FeedCache = {
      savedAt: Date.now(),
      posts: params.posts,
      stories: params.stories,
      newsPosts: params.newsPosts,
    };

    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage peut être plein. On ignore pour ne pas ralentir l'app.
  }
}

function mapRpcPost(row: FeedPostRpcRow): FeedPost {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    content: row.content,
    media_url: row.media_url,
    media_type: row.media_type,
    created_at: row.created_at,
    comments_count: Number(row.comments_count ?? 0),
    profiles: row.profile_id
      ? {
          id: row.profile_id,
          username: row.username,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
        }
      : null,
  };
}

export default function FeedPage() {
  const { profile } = useAuth();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstLoadRef = useRef(true);
  const loadingFeedRef = useRef(false);
  const loadingPostsRef = useRef(false);
  const loadingStoriesRef = useRef(false);
  const loadingNewsRef = useRef(false);

  const loadPostsFallback = useCallback(async (currentLimit: number) => {
    const { data, error } = await supabase
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
      .order("created_at", { ascending: false })
      .limit(currentLimit);

    if (error) {
      console.error("Erreur chargement publications :", error.message);
      return [];
    }

    const rawPosts = ((data ?? []) as unknown) as FeedPost[];
    const postIds = rawPosts.map((post) => post.id);

    const commentsCountByPost: Record<string, number> = {};

    if (postIds.length > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

      if (commentsError) {
        console.error(
          "Erreur chargement commentaires :",
          commentsError.message
        );
      } else {
        for (const comment of commentsData ?? []) {
          const postId = String(comment.post_id);
          commentsCountByPost[postId] =
            (commentsCountByPost[postId] ?? 0) + 1;
        }
      }
    }

    return rawPosts.map((post) => ({
      ...post,
      comments_count: commentsCountByPost[post.id] ?? 0,
    }));
  }, []);

  const loadPosts = useCallback(
    async (customLimit = limit) => {
      if (loadingPostsRef.current) return;

      loadingPostsRef.current = true;

      try {
        const { data, error } = await supabase.rpc("get_home_feed_posts", {
          p_limit: customLimit,
        });

        if (!error && data) {
          const rows = ((data ?? []) as unknown) as FeedPostRpcRow[];
          setPosts(rows.map(mapRpcPost));
          return;
        }

        const fallbackPosts = await loadPostsFallback(customLimit);
        setPosts(fallbackPosts);
      } catch (error) {
        console.error("Erreur feed RPC :", error);

        const fallbackPosts = await loadPostsFallback(customLimit);
        setPosts(fallbackPosts);
      } finally {
        loadingPostsRef.current = false;
      }
    },
    [limit, loadPostsFallback]
  );

  const loadStories = useCallback(async () => {
    if (loadingStoriesRef.current) return;

    loadingStoriesRef.current = true;

    const { data, error } = await supabase
      .from("stories")
      .select(
        `
        id,
        user_id,
        media_url,
        media_type,
        created_at,
        expires_at,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `
      )
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(STORIES_LIMIT);

    loadingStoriesRef.current = false;

    if (error) {
      console.error("Erreur chargement stories :", error.message);
      return;
    }

    setStories(((data ?? []) as unknown) as Story[]);
  }, []);

  const loadNewsPosts = useCallback(async () => {
    if (loadingNewsRef.current) return;

    loadingNewsRef.current = true;

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
      .order("published_at", { ascending: false })
      .limit(NEWS_LIMIT);

    loadingNewsRef.current = false;

    if (error) {
      console.error("Erreur chargement actualités :", error.message);
      return;
    }

    setNewsPosts(((data ?? []) as unknown) as NewsPost[]);
  }, []);

  const loadFeed = useCallback(
    async (options?: { silent?: boolean }) => {
      if (loadingFeedRef.current) return;

      loadingFeedRef.current = true;

      if (!options?.silent) {
        setLoading(true);
      }

      setRefreshing(true);

      await Promise.allSettled([
        loadPosts(limit),
        loadStories(),
        loadNewsPosts(),
      ]);

      setRefreshing(false);
      setLoading(false);
      loadingFeedRef.current = false;
      firstLoadRef.current = false;
    },
    [limit, loadPosts, loadStories, loadNewsPosts]
  );

  async function handlePostCreated() {
    setLimit(PAGE_SIZE);
    await loadPosts(PAGE_SIZE);
  }

  async function handleManualRefresh() {
    await loadFeed({ silent: true });
  }

  useEffect(() => {
    const cachedFeed = readFeedCache();

    if (cachedFeed) {
      setPosts(cachedFeed.posts ?? []);
      setStories(cachedFeed.stories ?? []);
      setNewsPosts(cachedFeed.newsPosts ?? []);
      setLoading(false);
    }

    void loadFeed({
      silent: Boolean(cachedFeed),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstLoadRef.current) return;

    void loadPosts(limit);
  }, [limit, loadPosts]);

  useEffect(() => {
    saveFeedCache({
      posts,
      stories,
      newsPosts,
    });
  }, [posts, stories, newsPosts]);

  useEffect(() => {
    const refreshOnFocus = () => {
      void loadFeed({ silent: true });
    };

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadFeed]);

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
            <Link
              to="/profile/me"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <Users size={17} /> Mon profil
            </Link>

            <Link
              to="/groups"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <Sparkles size={17} /> Groupes
            </Link>

            <Link
              to="/messages"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <MessageCircle size={17} /> Messages
            </Link>

            <Link
              to="/settings"
              className="flex items-center gap-3 rounded-2xl p-3 font-semibold hover:bg-accent"
            >
              <ShieldCheck size={17} /> Paramètres
            </Link>
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
                Publications, actualités, tendances et contenus récents.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="hidden rounded-xl sm:inline-flex"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {refreshing ? "..." : "Actualiser"}
              </Button>

              <div className="icon-pill h-10 w-10">
                <TrendingUp size={19} />
              </div>
            </div>
          </div>

          <div className="custom-scrollbar flex gap-3 overflow-x-auto pb-1">
            <button className="w-20 shrink-0 text-center" type="button">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-dashed border-primary/40 bg-primary/10 text-primary">
                <Plus size={20} />
              </div>

              <div className="mt-1 text-[11px] font-semibold">Ajouter</div>
            </button>

            {stories.map((story) => (
              <StoryItem key={story.id} story={story} />
            ))}
          </div>
        </Card>

        <CreatePostForm onCreated={handlePostCreated} />

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
              <PostCard
                key={item.id}
                post={item.post}
                onChange={() => loadPosts(limit)}
              />
            );
          })
        )}

        {feedItems.length > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLimit((value) => value + PAGE_SIZE)}
            disabled={refreshing}
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
              Actualités optimisées
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Le feed utilise maintenant un cache local et une fonction SQL
              rapide pour éviter les chargements lourds.
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
          className="max-h-[320px] w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
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
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
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

          {news.source_url ? (
            <a
              href={news.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-accent"
            >
              Lire l’article
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          ) : null}
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