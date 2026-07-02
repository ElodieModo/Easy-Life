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
import Link from "next/link";
import { useState } from "react";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Veuillez entrer votre email");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Une erreur s'est produite";
      if (message.includes("invalid email")) {
        setError("Format d'email invalide");
      } else {
        setError(getAuthErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Vérifiez votre email</CardTitle>
            <CardDescription>Lien de réinitialisation envoyé</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="success">
              <AlertTitle>Email envoyé avec succès</AlertTitle>
              <AlertDescription>
                Si vous avez un compte avec cet email, vous recevrez un lien pour réinitialiser votre mot de passe. Veuillez vérifier votre boîte email (et les spams).
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="text-black underline hover:no-underline"
              >
                Retour à la connexion
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Réinitialiser votre mot de passe</CardTitle>
            <CardDescription>
              Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Envoi en cours..." : "Envoyer le lien de réinitialisation"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Vous avez déjà un compte ?{" "}
                <Link
                  href="/auth/login"
                  className="text-black underline hover:no-underline"
                >
                  Connectez-vous
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
