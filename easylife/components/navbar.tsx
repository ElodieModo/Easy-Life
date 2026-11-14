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
    { href: "/protected/notes", label: "Notes", icon: "📝" },
    { href: "/protected/planning-enfants", label: "Planning", icon: "👧" },
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
      <nav className="sticky top-0 z-40 border-b border-orange-200/80 bg-[#fffaf0]/95 text-slate-700 shadow-[0_4px_18px_rgba(75,55,25,0.08)] backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 sm:py-3">
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
              <span className="inline-flex items-center rounded-full bg-orange-500 px-2.5 py-1 text-xs font-black tracking-wide text-white shadow-sm sm:px-4 sm:text-sm md:text-base">
                EASY LIFE
              </span>
            </Link>
          </div>

          <div className="hidden md:flex min-w-0 items-center justify-self-center gap-5 text-sm font-medium">
            <Link href="/" className="transition-colors hover:text-orange-700">
              Accueil
            </Link>
            <Link href="/protected/liste-courses" className="transition-colors hover:text-orange-700">
              Liste de courses
            </Link>
            <Link href="/protected/notes" className="transition-colors hover:text-orange-700">
              Notes
            </Link>
            <Link href="/protected/planning-enfants" className="hover:text-sky-700 transition-colors">
              Planning
            </Link>
            <Link href="/protected/adresses-utiles" className="hover:text-sky-700 transition-colors">
              Adresses utiles
            </Link>
          </div>

          <div className="hidden md:flex w-44 flex-col items-stretch justify-self-end gap-1.5">
            <Link
              href="/"
              className="rounded-lg bg-orange-500 px-3 py-2 text-center font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Accueil
            </Link>
            <Link
              href="/protected/parametres"
              className="rounded-lg bg-amber-400 px-3 py-2 text-center font-semibold text-amber-950 transition-colors hover:bg-amber-500"
            >
              Paramètres
            </Link>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-lg bg-teal-500 px-3 py-2 text-center font-semibold text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshing ? "Actualisation..." : "🔄 Actualiser"}
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoading || isRefreshing}
              className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </div>
        </div>

        <div className="pb-2.5 md:hidden">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-orange-200 bg-white/90 p-1 shadow-sm">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-1 text-xs font-semibold text-orange-700"
            >
              Accueil
            </Link>

            <Link
              href="/protected/parametres"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-1 text-xs font-semibold text-amber-700"
            >
              Param.
            </Link>

            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "..." : "Déco"}
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshing ? "Actualisation..." : "🔄 Actualiser"}
          </button>

          <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-orange-200 bg-white/90 p-1 shadow-sm">
            {mobileTabs.map((tab) => {
              const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-semibold transition-colors active:scale-[0.98] sm:text-xs ${
                    isActive
                      ? "bg-orange-100 text-orange-900"
                      : "text-slate-600 hover:bg-orange-50 hover:text-slate-800 active:bg-orange-100 active:text-orange-900"
                  }`}
                >
                  <span aria-hidden="true" className="text-base">{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
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
