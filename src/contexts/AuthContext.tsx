import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/db/supabase";
import type { Profile } from "@/types/types";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erreur chargement profil :", error.message);
      setProfile(null);
      return;
    }

    setProfile((data as Profile) ?? null);
  }

  async function refreshProfile() {
    let currentUser = user;

    if (!currentUser) {
      const { data } = await supabase.auth.getUser();
      currentUser = data.user ?? null;
    }

    if (!currentUser?.id) {
      setProfile(null);
      return;
    }

    await loadProfile(currentUser.id);
  }

  useEffect(() => {
    async function initAuth() {
      setLoading(true);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Erreur session :", error.message);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const currentUser = data.session?.user ?? null;

      setUser(currentUser);

      if (currentUser) {
        await loadProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  async function signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          username,
          email,
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) throw profileError;

      setUser(data.user);
      await loadProfile(data.user.id);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error("Erreur déconnexion :", error.message);
      throw error;
    }

    setUser(null);
    setProfile(null);

    Object.keys(localStorage).forEach((key) => {
      if (key.includes("supabase") || key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    });
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }

  return ctx;
}