"use client";

import Link from "next/link";
import { ExternalCalendarZone } from "@/components/external-calendar-zone";
import { Navbar } from "@/components/navbar";

export default function SharedCalendarSettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">Paramètres du calendrier partagé</h1>
            <Link
              href="/protected/calendrier-externe"
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Retour au calendrier
            </Link>
          </div>
          <p className="text-slate-600">
            Gérez ici la connexion iCal, la synchronisation manuelle et l'état de partage famille.
          </p>
        </div>

        <ExternalCalendarZone />
      </div>
    </div>
  );
}
