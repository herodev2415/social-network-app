import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Group } from "@/types/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);

  async function load() {
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups((data as Group[]) ?? []);
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const { data } = await supabase.from("groups").insert({
      name: fd.get("name"),
      description: fd.get("description"),
      is_private: fd.get("is_private") === "on",
      creator_id: user.id
    }).select().single();
    if (data) await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id, role: "admin" });
    e.currentTarget.reset();
    load();
  }

  async function join(id: string) {
    if (!user) return;
    await supabase.from("group_members").insert({ group_id: id, user_id: user.id });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
      <Card className="p-3">
        <h1 className="mb-3 text-lg font-bold">Créer un groupe</h1>
        <form onSubmit={create} className="space-y-2">
          <Input name="name" required placeholder="Nom du groupe" />
          <Textarea name="description" placeholder="Description" />
          <label className="flex items-center gap-2 text-xs"><input name="is_private" type="checkbox" /> Groupe privé</label>
          <Button type="submit">Créer</Button>
        </form>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.id} className="p-3">
            <h2 className="font-semibold">{g.name}</h2>
            <p className="text-sm text-muted-foreground">{g.description || "Aucune description."}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => join(g.id)}>Rejoindre</Button>
              <Button size="sm" variant="outline" onClick={() => location.href=`/groups/${g.id}`}>Voir</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
