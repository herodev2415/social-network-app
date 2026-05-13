import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/db/supabase";
import type { Profile } from "@/types/types";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const { user } = useAuth();

  async function search(query = q) {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .or(`username.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%`)
      .limit(20);

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setResults((data as Profile[]) ?? []);
  }

  async function addFriend(id: string) {
    if (!user || user.id === id || addingId) return;

    setAddingId(id);

    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: id,
      status: "pending",
    });

    setAddingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Demande envoyée.");
  }

  useEffect(() => {
    const initialQuery = params.get("q") || "";
    if (initialQuery.trim().length >= 2) {
      search(initialQuery);
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q });
          search(q);
        }}
        className="flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher des utilisateurs..."
        />

        <Button type="submit" disabled={loading}>
          {loading ? "..." : "Rechercher"}
        </Button>
      </form>

      {loading && (
        <Card className="p-3 text-sm text-muted-foreground">
          Recherche en cours...
        </Card>
      )}

      {!loading &&
        results.map((p) => (
          <Card key={p.id} className="flex items-center gap-3 p-3">
            <Avatar src={p.avatar_url} name={p.full_name || p.username} />

            <div className="flex-1">
              <div className="text-sm font-semibold">
                {p.full_name || p.username}
              </div>
              <div className="text-xs text-muted-foreground">
                @{p.username}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => addFriend(p.id)}
              disabled={addingId === p.id || user?.id === p.id}
            >
              {addingId === p.id ? "..." : "Ajouter"}
            </Button>
          </Card>
        ))}
    </div>
  );
}