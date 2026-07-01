"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export function SignUpForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push("Au minimum 8 caractères");
    if (!/[A-Z]/.test(pwd)) errors.push("Au moins une majuscule");
    if (!/[0-9]/.test(pwd)) errors.push("Au moins un chiffre");
    return errors;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    setPasswordErrors([]);

    if (!email || !password || !repeatPassword) {
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
    const encodedNextPath = encodeURIComponent(nextPath);
    setIsLoading(true);

    try {
      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodedNextPath}`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setError("Cet email est déjà utilisé");
        } else if (signUpError.message.includes("invalid email")) {
          setError("Format d'email invalide");
        } else {
          setError(signUpError.message);
        }
      } else {
        // Si l'utilisateur est immédiatement confirmé (sans email requis en dev)
        if (data?.user && data.user.confirmed_at) {
          // Connexion automatique
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (loginError) {
            setError("Inscription réussie mais erreur de connexion");
          } else {
            router.push(nextPath);
            router.refresh();
          }
        } else {
          // Redirection vers page de succès avec instruction
          router.push(`/auth/sign-up-success?next=${encodedNextPath}`);
        }
      }
    } catch (err) {
      setError("Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="flex flex-col gap-4 w-full max-w-sm p-6 bg-white rounded-lg shadow">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-black">S&apos;inscrire</h2>
        <p className="text-sm text-gray-500 mt-1">Créez un nouveau compte</p>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
        <input 
          id="email"
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
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordErrors([]);
          }}
          required 
          disabled={isLoading}
          placeholder="••••••••"
          className="border border-gray-300 p-2 rounded text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black" 
        />
        {passwordErrors.length > 0 && (
          <div className="text-xs text-red-600 space-y-1 mt-1">
            {passwordErrors.map((err, idx) => (
              <div key={idx}>• {err}</div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="repeatPassword" className="text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
        <input 
          id="repeatPassword"
          type="password" 
          value={repeatPassword} 
          onChange={(e) => setRepeatPassword(e.target.value)} 
          required 
          disabled={isLoading}
          placeholder="••••••••"
          className="border border-gray-300 p-2 rounded text-black placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black" 
        />
      </div>

      <button 
        type="submit" 
        disabled={isLoading || passwordErrors.length > 0} 
        className="bg-black text-white p-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-2 hover:bg-gray-900 transition-colors"
      >
        {isLoading ? "Inscription en cours..." : "S'inscrire"}
      </button>

      <div className="text-sm text-center text-gray-600 mt-2">
        Vous avez déjà un compte ? <Link href="/auth/login" className="text-black underline hover:no-underline">Se connecter</Link>
      </div>
    </form>
  );
}
