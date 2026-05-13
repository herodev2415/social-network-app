import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/db/supabase";
import type { Profile } from "@/types/types";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [results, setResults] = useState<Profile[]>([]);
  const { user } = useAuth();

  async function search(query = q) {
    const { data } = await supabase.from("profiles").select("*").or(`username.ilike.%${query}%,full_name.ilike.%${query}%`).limit(30);
    setResults((data as Profile[]) ?? []);
  }

  async function addFriend(id: string) {
    if (!user || user.id === id) return;
    await supabase.from("friendships").insert({ user_id: user.id, friend_id: id, status: "pending" });
  }

  useEffect(() => { if (q) search(q); }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); setParams({ q }); search(); }} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher des utilisateurs..." />
        <Button type="submit">Rechercher</Button>
      </form>
      {results.map((p) => (
        <Card key={p.id} className="flex items-center gap-3 p-3">
          <Avatar src={p.avatar_url} name={p.full_name || p.username} />
          <div className="flex-1">
            <div className="text-sm font-semibold">{p.full_name || p.username}</div>
            <div className="text-xs text-muted-foreground">@{p.username}</div>
          </div>
          <Button size="sm" onClick={() => addFriend(p.id)}>Ajouter ami</Button>
        </Card>
      ))}
    </div>
  );
}
