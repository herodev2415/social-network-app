import { useEffect, useState } from "react";
import { Phone, Video } from "lucide-react";
import { supabase } from "@/db/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

type Call = { id: string; caller_id: string; receiver_id: string; call_type: "audio" | "video"; status: string; duration: number; created_at: string };

export default function CallsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Call[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("calls").select("*").or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: false }).then(({ data }) => setItems((data as Call[]) ?? []));
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-lg font-bold">Historique des appels</h1>
      {items.map((c) => (
        <Card key={c.id} className="flex items-center gap-3 p-3">
          {c.call_type === "video" ? <Video size={18} /> : <Phone size={18} />}
          <div className="flex-1 text-sm">
            <div className="font-semibold">{c.status === "missed" ? "Appel manqué" : c.status}</div>
            <div className="text-xs text-muted-foreground">Durée : {c.duration}s • {timeAgo(c.created_at)}</div>
          </div>
        </Card>
      ))}
      {!items.length && <Card className="p-3 text-sm text-muted-foreground">Aucun appel pour le moment.</Card>}
    </div>
  );
}
