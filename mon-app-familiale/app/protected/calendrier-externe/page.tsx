"use client";

import { ExternalCalendarZone } from "@/components/external-calendar-zone";
import { Navbar } from "@/components/navbar";

export default function ExternalCalendarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
        <ExternalCalendarZone showManagementPanel={false} />
      </div>
    </div>
  );
}