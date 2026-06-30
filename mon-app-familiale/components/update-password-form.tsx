"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (tokenHash && type === "recovery") {
      const supabase = createClient();
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            setError("Lien invalide ou expiré. Veuillez faire une nouvelle demande.");
          } else {
            setSessionReady(true);
          }
        });
    } else {
      // Session already established (e.g. via /auth/confirm redirect)
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSessionReady(true);
        else setError("Lien invalide ou expiré. Veuillez faire une nouvelle demande.");
      });
    }
  }, [searchParams]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push("Au minimum 8 caractères");
    if (!/[A-Z]/.test(pwd)) errors.push("Au moins une majuscule");
    if (!/[0-9]/.test(pwd)) errors.push("Au moins un chiffre");
    return errors;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    setPasswordErrors([]);

    if (!password || !repeatPassword) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    const errors = validatePassword(password);
    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    if (password !== repeatPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/protected");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Une erreur s'est produite";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Réinitialiser votre mot de passe</CardTitle>
          <CardDescription>
            {sessionReady ? "Veuillez entrer votre nouveau mot de passe ci-dessous." : "Vérification du lien..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} style={{ display: sessionReady ? undefined : "none" }}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordErrors([]);
                  }}
                  disabled={isLoading}
                />
                {passwordErrors.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1 mt-1">
                    {passwordErrors.map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeatPassword">Confirmer le mot de passe</Label>
                <Input
                  id="repeatPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || passwordErrors.length > 0}>
                {isLoading ? "Sauvegarde en cours..." : "Enregistrer le nouveau mot de passe"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
