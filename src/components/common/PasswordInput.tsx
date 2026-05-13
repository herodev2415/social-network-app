import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={showPassword ? "text" : "password"}
        className={cn("h-11 rounded-2xl bg-muted/60 pr-11", className)}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-9 w-9 rounded-xl"
        onClick={() => setShowPassword((current) => !current)}
        aria-label={
          showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </Button>
    </div>
  );
}