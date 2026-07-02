"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { getAuthErrorMessage } from "@/lib/auth-errors";

type Mode = "password" | "magic-link";

export function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("magic-link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfoMessage(null);
    setMagicLinkSent(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        if (loginError.message.includes("Invalid login credentials")) {
          setError("Email ou mot de passe incorrect");
        } else if (loginError.message.includes("Email not confirmed")) {
          setError("Veuillez confirmer votre email avant de vous connecter");
        } else {
          setError(loginError.message);
        }
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch {
      setError("Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Veuillez saisir votre email");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (otpError) {
        if (otpError.message.toLowerCase().includes("not found") || otpError.message.toLowerCase().includes("signups not allowed")) {
          setError("Aucun compte trouvé pour cet email. Créez d'abord un compte.");
        } else {
          setError(getAuthErrorMessage(otpError));
        }
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setError("Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError("Saisissez d'abord votre email pour renvoyer la confirmation");
      return;
    }

    const supabase = createClient();
    setIsResendingConfirmation(true);
    setError(null);
    setInfoMessage(null);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (resendError) {
        setError(getAuthErrorMessage(resendError));
      } else {
        setInfoMessage("Email de confirmation renvoyé. Vérifiez votre boîte mail et vos spams.");
      }
    } catch {
      setError("Une erreur s'est produite lors du renvoi de l'email");
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm p-6 bg-white rounded-lg shadow">
      <div className="mb-1">
        <h2 className="text-xl font-bold text-black">Se connecter</h2>
        <p className="text-sm text-gray-500 mt-1">Connectez-vous à votre compte</p>
      </div>

      {/* Onglets */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
        <button
          type="button"
          onClick={() => switchMode("magic-link")}
          className={`flex-1 py-2 transition-colors ${
            mode === "magic-link"
              ? "bg-black text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Lien magique
        </button>
        <button
          type="button"
          onClick={() => switchMode("password")}
          className={`flex-1 py-2 transition-colors border-l border-gray-200 ${
            mode === "password"
              ? "bg-black text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Mot de passe
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {infoMessage && (
        <Alert>
          <AlertDescription>{infoMessage}</AlertDescription>
        </Alert>
      )}

      {/* Mode lien magique */}
      {mode === "magic-link" && (
        <>
          {magicLinkSent ? (
            <div className="flex flex-col gap-3 text-center py-2">
              <p className="text-3xl">📬</p>
              <p className="font-semibold text-gray-800">Vérifiez votre boîte mail</p>
              <p className="text-sm text-gray-500">
                Un lien de connexion a été envoyé à <span className="font-medium text-gray-700">{email}</span>.
                Cliquez dessus pour accéder à votre compte.
              </p>
              <p className="text-xs text-gray-400">Pensez à vérifier vos spams.</p>
              <button
                type="button"
                onClick={() => { setMagicLinkSent(false); setError(null); }}
                className="text-sm text-black underline hover:no-underline mt-1"
              >
                Utiliser un autre email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="email-magic" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email-magic"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="vous@exemple.com"
                  className="border border-gray-300 p-2 rounded text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-black text-white p-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-colors"
              >
                {isLoading ? "Envoi en cours…" : "Recevoir un lien de connexion"}
              </button>
              <p className="text-xs text-center text-gray-400">
                Pas de mot de passe à retenir — un simple clic suffit.
              </p>
            </form>
          )}
        </>
      )}

      {/* Mode mot de passe */}
      {mode === "password" && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email-pwd" className="text-sm font-medium text-gray-700">Email</label>
            <input
              id="email-pwd"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              placeholder="vous@exemple.com"
              className="border border-gray-300 p-2 rounded text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              placeholder="••••••••"
              className="border border-gray-300 p-2 rounded text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="bg-black text-white p-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-1 hover:bg-gray-900 transition-colors"
          >
            {isLoading ? "Connexion en cours…" : "Se connecter"}
          </button>

          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={isResendingConfirmation || isLoading}
            className="border border-gray-300 text-black p-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
          >
            {isResendingConfirmation ? "Renvoi en cours…" : "Renvoyer l'email de confirmation"}
          </button>

          <div className="flex flex-col gap-2 text-sm text-center text-gray-600">
            <Link href="/auth/forgot-password" className="text-black underline hover:no-underline">
              Mot de passe oublié ?
            </Link>
          </div>
        </form>
      )}

      <div className="text-sm text-center text-gray-600 pt-1 border-t border-gray-100">
        Pas de compte ?{" "}
        <Link href="/auth/sign-up" className="text-black underline hover:no-underline">
          S&apos;inscrire
        </Link>
      </div>
    </div>
  );
}
