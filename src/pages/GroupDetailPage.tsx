import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/db/supabase";
import type { Group } from "@/types/types";
import { Card } from "@/components/ui/card";

export default function GroupDetailPage() {
  const { id } = useParams();
  const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
  .from("groups")
  .select("id, name, description, is_private, creator_id, created_at")
  .eq("id", id)
  .single()
  .then(({ data }) => setGroup(data as Group));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Card className="p-4">
        <h1 className="text-xl font-bold">{group?.name}</h1>
        <p className="text-sm text-muted-foreground">{group?.description}</p>
      </Card>
      <Card className="p-4 text-sm">Les publications de groupe peuvent être ajoutées avec la table group_posts.</Card>
    </div>
  );
}
