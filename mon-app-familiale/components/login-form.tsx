"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    const supabase = createClient();
      const nextPath = searchParams.get("next") || "/";
    setIsLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        if (loginError.message.includes("Invalid login credentials")) {
          setError("Email ou mot de passe incorrect");
        } else if (loginError.message.includes("Email not confirmed")) {
          setError("Veuillez confirmer votre email");
        } else {
          setError(loginError.message);
        }
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch (err) {
      setError("Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-sm p-6 bg-white rounded-lg shadow">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-black">Se connecter</h2>
        <p className="text-sm text-gray-500 mt-1">Connectez-vous à votre compte</p>
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
        className="bg-black text-white p-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-2 hover:bg-gray-900 transition-colors"
      >
        {isLoading ? "Connexion en cours..." : "Se connecter"}
      </button>

      <div className="flex flex-col gap-2 text-sm text-center text-gray-600 mt-2">
        <Link href="/auth/forgot-password" className="text-black underline hover:no-underline">
          Mot de passe oublié ?
        </Link>
        <div>
          Pas de compte ? <Link href="/auth/sign-up" className="text-black underline hover:no-underline">S&apos;inscrire</Link>
        </div>
      </div>
    </form>
  );
}
