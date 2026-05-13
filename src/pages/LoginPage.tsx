import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Users, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/common/PasswordInput";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Connexion impossible.";
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();

    const password = String(formData.get("password") || "");

    if (!email || !password) {
      toast.error("Veuillez remplir l’email et le mot de passe.");
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);

      toast.success("Connexion réussie.");

      navigate("/", { replace: true });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border bg-white/80 shadow-2xl backdrop-blur-xl md:grid-cols-[1.1fr_0.9fr] dark:bg-slate-950/80">
        <div className="hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-500 p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Sparkles />
            </div>

            <h1 className="mt-8 text-4xl font-black leading-tight">
              Retrouve ta communauté en quelques secondes.
            </h1>

            <p className="mt-4 max-w-md text-white/80">
              Une interface moderne pour publier, échanger et découvrir les
              dernières actualités.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
              <Users className="mb-2" />
              Communauté active
            </div>

            <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
              <ShieldCheck className="mb-2" />
              Accès sécurisé
            </div>
          </div>
        </div>

        <Card className="rounded-none border-0 bg-transparent p-6 shadow-none sm:p-10">
          <div className="mb-7 text-center md:text-left">
            <div className="gradient-brand mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl text-white md:mx-0">
              <Sparkles size={22} />
            </div>

            <h2 className="text-2xl font-black tracking-tight">Connexion</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Bienvenue sur Social Connect
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Input
              name="email"
              type="email"
              placeholder="Email"
              required
              autoComplete="email"
              disabled={loading}
              className="h-11 rounded-2xl bg-muted/60"
            />

            <PasswordInput
              name="password"
              placeholder="Mot de passe"
              required
              disabled={loading}
            />

            <Button
              disabled={loading}
              className="w-full"
              type="submit"
              size="lg"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link className="font-bold text-primary" to="/register">
              Créer un compte
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}