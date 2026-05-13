import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Group } from "@/types/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function GroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("groups")
      .select("id, name, description, is_private, creator_id, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setGroups((data as Group[]) ?? []);
    setLoading(false);
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || creating) return;

    const form = e.currentTarget;
    const fd = new FormData(form);

    setCreating(true);

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: String(fd.get("name") || ""),
        description: String(fd.get("description") || ""),
        is_private: fd.get("is_private") === "on",
        creator_id: user.id,
      })
      .select("id, name, description, is_private, creator_id, created_at")
      .single();

    if (error) {
      setCreating(false);
      toast.error(error.message);
      return;
    }

    await supabase.from("group_members").insert({
      group_id: data.id,
      user_id: user.id,
      role: "admin",
    });

    setGroups((prev) => [data as Group, ...prev]);
    form.reset();
    setCreating(false);
    toast.success("Groupe créé.");
  }

  async function join(id: string) {
    if (!user || joiningId) return;

    setJoiningId(id);

    const { error } = await supabase.from("group_members").insert({
      group_id: id,
      user_id: user.id,
    });

    setJoiningId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Groupe rejoint.");
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
      <Card className="p-3">
        <h1 className="mb-3 text-lg font-bold">Créer un groupe</h1>

        <form onSubmit={create} className="space-y-2">
          <Input name="name" required placeholder="Nom du groupe" />
          <Textarea name="description" placeholder="Description" />

          <label className="flex items-center gap-2 text-xs">
            <input name="is_private" type="checkbox" /> Groupe privé
          </label>

          <Button type="submit" disabled={creating}>
            {creating ? "Création..." : "Créer"}
          </Button>
        </form>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {loading && (
          <>
            {[1, 2, 3, 4].map((item) => (
              <Card key={item} className="animate-pulse p-3">
                <div className="mb-3 h-4 w-1/2 rounded bg-muted" />
                <div className="mb-2 h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </Card>
            ))}
          </>
        )}

        {!loading &&
          groups.map((g) => (
            <Card key={g.id} className="p-3">
              <h2 className="font-semibold">{g.name}</h2>

              <p className="text-sm text-muted-foreground">
                {g.description || "Aucune description."}
              </p>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => join(g.id)}
                  disabled={joiningId === g.id}
                >
                  {joiningId === g.id ? "..." : "Rejoindre"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/groups/${g.id}`)}
                >
                  Voir
                </Button>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}