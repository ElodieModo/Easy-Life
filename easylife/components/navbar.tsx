"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mobileTabs = [
    { href: "/protected/liste-courses", label: "Courses", icon: "🛒" },
    { href: "/protected/menu-semaine", label: "Menu", icon: "🍽️" },
    { href: "/protected/planning-enfants", label: "Enfants", icon: "👧" },
    { href: "/protected/calendrier-externe", label: "Calendrier partagé", icon: "📅" },
    { href: "/protected/adresses-utiles", label: "Adresses", icon: "📍" },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

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
    <>
      <nav className="bg-gradient-to-r from-stone-50 to-rose-50 text-slate-700 shadow-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center py-3 gap-4">
          <div className="justify-self-start">
            <Link href="/" aria-label="Easy Life" className="group flex items-center gap-2 min-w-0">
              <Image
                src="/easy-life-logo-v2.svg"
                alt="Logo Easy Life"
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl shadow-sm"
                priority
              />
              <span className="inline-flex items-center rounded-full px-3 sm:px-4 py-1 text-xs sm:text-sm md:text-base font-black tracking-wide text-white bg-gradient-to-r from-rose-600 via-fuchsia-500 to-orange-500 shadow-sm">
                EASY LIFE
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6 justify-self-center min-w-0">
            <Link href="/" className="hover:text-rose-700 transition-colors">
              Accueil
            </Link>
            <Link href="/protected/liste-courses" className="hover:text-rose-700 transition-colors">
              Liste de courses
            </Link>
            <Link href="/protected/menu-semaine" className="hover:text-rose-700 transition-colors">
              Menu de la semaine
            </Link>
            <Link href="/protected/planning-enfants" className="hover:text-sky-700 transition-colors">
              Planning enfants
            </Link>
            <Link href="/protected/calendrier-externe" className="hover:text-sky-700 transition-colors">
              Calendrier partagé
            </Link>
            <Link href="/protected/adresses-utiles" className="hover:text-sky-700 transition-colors">
              Adresses utiles
            </Link>
          </div>

          <div className="hidden md:flex flex-col items-stretch gap-2 w-48 justify-self-end">
            <Link
              href="/"
              className="text-center bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Accueil
            </Link>
            <Link
              href="/protected/parametres"
              className="text-center bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Paramètres
            </Link>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-center bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? "Actualisation..." : "🔄 Actualiser"}
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoading || isRefreshing}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </div>
        </div>

        <div className="md:hidden pb-3">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-rose-100 bg-white/90 p-1.5 shadow-sm">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-1.5 py-1 text-xs font-semibold text-orange-700"
            >
              Accueil
            </Link>

            <Link
              href="/protected/parametres"
              className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1 text-xs font-semibold text-amber-700"
            >
              Param.
            </Link>

            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-1.5 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : "Déco"}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshing ? "Actualisation..." : "🔄 Actualiser"}
          </button>

          <div className="mt-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileTabs.map((tab) => {
              const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        </div>
      </nav>
    </>
  );
}
