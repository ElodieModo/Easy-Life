"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Navbar() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      setIsLoading(false);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-stone-50 to-rose-50 text-slate-700 shadow-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center py-3 gap-4">
          {/* Logo/Brand (à gauche) */}
          <div className="justify-self-start">
            <Link href="/" aria-label="Easy Life" className="group flex items-center gap-2">
              <span className="inline-flex items-center whitespace-nowrap rounded-full px-4 py-1 text-sm md:text-base font-black tracking-wide text-white bg-gradient-to-r from-rose-600 via-fuchsia-500 to-orange-500 shadow-sm">
                EASY LIFE
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6 justify-self-center min-w-0">
            <Link
              href="/"
              className="hover:text-rose-700 transition-colors"
            >
              Accueil
            </Link>
            <Link
              href="/protected/liste-courses"
              className="hover:text-rose-700 transition-colors"
            >
              Liste de courses
            </Link>
            <Link
              href="/protected/menu-semaine"
              className="hover:text-rose-700 transition-colors"
            >
              Menu de la semaine
            </Link>
            <Link
              href="/protected/planning-enfants"
              className="hover:text-sky-700 transition-colors"
            >
              Planning enfants
            </Link>
            <Link
              href="/protected/adresses-utiles"
              className="hover:text-sky-700 transition-colors"
            >
              Adresses utiles
            </Link>
            <Link
              href="/protected/calendrier-externe"
              className="hover:text-sky-700 transition-colors"
            >
              Calendrier partagé
            </Link>
            <Link
              href="/protected/famille"
              className="hover:text-rose-700 transition-colors"
            >
              Ma famille
            </Link>
          </div>

          {/* Right Side Actions */}
          <div className="flex flex-col items-stretch gap-2 w-40 justify-self-end">
            <Link
              href="/"
              className="text-center bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Menu
            </Link>
            <Link
              href="/protected/parametres"
              className="text-center bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Paramètres
            </Link>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
