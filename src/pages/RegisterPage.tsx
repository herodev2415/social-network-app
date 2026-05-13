import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/common/PasswordInput";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!accepted) {
      return toast.error("Tu dois accepter les CGU et la politique de confidentialité.");
    }

    const fd = new FormData(e.currentTarget);
    setLoading(true);

    try {
      await signUp(
        String(fd.get("email")),
        String(fd.get("password")),
        String(fd.get("username"))
      );

      toast.success("Compte créé. Vérifie ton email si la confirmation est activée.");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="glass-panel w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-white">
            <Sparkles size={22} />
          </div>

          <h1 className="text-2xl font-black tracking-tight">Créer un compte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rejoins la communauté en moins d’une minute.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            name="username"
            placeholder="Nom d’utilisateur"
            required
            className="h-11 rounded-2xl bg-muted/60"
          />

          <Input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="h-11 rounded-2xl bg-muted/60"
          />

          <PasswordInput
            name="password"
            placeholder="Mot de passe"
            minLength={6}
            required
          />

          <label className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <input
              className="mt-0.5"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>J’accepte les CGU et la Politique de confidentialité.</span>
          </label>

          <Button disabled={loading} className="w-full" type="submit" size="lg">
            {loading ? "Création..." : "S’inscrire"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link className="font-bold text-primary" to="/login">
            Connexion
          </Link>
        </p>
      </Card>
    </div>
  );
}