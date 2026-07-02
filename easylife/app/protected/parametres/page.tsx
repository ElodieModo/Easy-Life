"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";

const settingsItems = [
  {
    title: "Ma famille",
    description: "Gérer le nom affiché, créer la famille et inviter de nouveaux membres.",
    href: "/protected/parametres/ma-famille",
    cta: "Ouvrir le module",
  },
  {
    title: "Liste de courses",
    description: "Créer, renommer et sélectionner les listes utilisées par la famille.",
    href: "/protected/liste-courses",
    cta: "Ouvrir le module",
  },
  {
    title: "Notes",
    description: "Créer des listes de pense-bête ou de tâches, visibles par la famille ou privées.",
    href: "/protected/notes",
    cta: "Ouvrir le module",
  },
  {
    title: "Menu de la semaine",
    description: "Préparer les repas de la semaine et partager une vue claire pour toute la famille.",
    href: "/protected/menu-semaine",
    cta: "Ouvrir le module",
  },
  {
    title: "Planning enfants",
    description:
      "Paramétrer les activités hebdomadaires, catégories, mode durée et enfants concernés.",
    href: "/protected/parametres/planning-enfants",
    cta: "Configurer le module",
  },
  {
    title: "Calendrier partagé",
    description:
      "Configurer l'URL iCal, déclencher la synchronisation et choisir la vue (liste, mois, semaine).",
    href: "/protected/parametres/calendrier-partage",
    cta: "Configurer le module",
  },
  {
    title: "Adresses utiles",
    description: "Gérer les catégories d'adresses, notes et entrées partagées pour la famille.",
    href: "/protected/adresses-utiles",
    cta: "Ouvrir le module",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-800 mb-2">Paramètres</h1>
          <p className="text-slate-600">
            Centralisez ici les réglages des modules de l&apos;application. Les actions du quotidien restent dans chaque
            écran pour garder une interface simple.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {settingsItems.map((item) => (
            <article key={item.title} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-800">{item.title}</h2>
              <p className="text-sm text-slate-600 mt-2">{item.description}</p>
              <Link
                href={item.href}
                className="inline-flex mt-4 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded font-medium transition-colors"
              >
                {item.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
