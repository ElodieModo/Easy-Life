"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ExternalCalendarConfig = {
  provider: "google" | "outlook" | "ical";
  sourceUrl: string;
};

type FamilyInfo = {
  id: string;
  name: string;
};

type FamilyPayload = FamilyInfo | FamilyInfo[] | null;

type ConnectionRow = {
  provider: ExternalCalendarConfig["provider"];
  source_url: string;
  last_synced_at: string | null;
  updated_at: string;
};

type EventRow = {
  id: string;
  title: string;
  location: string | null;
  start_at: string;
  end_at: string | null;
  is_all_day: boolean;
};

type CalendarViewMode = "list" | "calendar" | "week";
const AUTO_SYNC_INTERVAL_MS = 60 * 60 * 1000;

type ExternalCalendarZoneProps = {
  showManagementPanel?: boolean;
};

const parseFamily = (value: FamilyPayload): FamilyInfo | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const providerLabel: Record<ExternalCalendarConfig["provider"], string> = {
  google: "Google Calendar",
  outlook: "Outlook Calendar",
  ical: "Flux iCal",
};

const startOfMonth = (date: Date) => {
  const value = new Date(date);
  value.setDate(1);
  value.setHours(0, 0, 0, 0);
  return value;
};

const startOfWeekMonday = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const dayIndex = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - dayIndex);
  return value;
};

const addDays = (date: Date, days: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const addMonths = (date: Date, months: number) => {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return value;
};

const dateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export function ExternalCalendarZone({ showManagementPanel = true }: ExternalCalendarZoneProps) {
  const supabase = useMemo(() => createClient(), []);
  const [provider, setProvider] = useState<ExternalCalendarConfig["provider"]>("google");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [membersCount, setMembersCount] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("list");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [weekCursor, setWeekCursor] = useState(() => startOfWeekMonday(new Date()));
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCalendarData = async () => {
    setIsLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Impossible de récupérer votre session utilisateur.");
      setIsLoading(false);
      return;
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("family_members")
      .select("family_id, family:families(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1);

    if (membershipError) {
      setErrorMessage("Impossible de charger votre famille active.");
      setIsLoading(false);
      return;
    }

    const row = membershipRows?.[0] as { family_id?: string; family?: FamilyPayload } | undefined;
    const activeFamily = parseFamily(row?.family ?? null);
    const familyId = row?.family_id ?? activeFamily?.id;
    setFamily(activeFamily);

    if (!familyId || !activeFamily) {
      setErrorMessage("Aucune famille active. Créez ou rejoignez une famille d'abord.");
      setEvents([]);
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    const { count } = await supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId);
    setMembersCount(count ?? 0);

    const { data: connection, error: connectionError } = await supabase
      .from("family_calendar_connections")
      .select("provider, source_url, last_synced_at, updated_at")
      .eq("family_id", familyId)
      .maybeSingle();

    if (connectionError) {
      setErrorMessage("Impossible de charger la connexion du calendrier partagé.");
      setIsLoading(false);
      return;
    }

    const typedConnection = connection as ConnectionRow | null;

    if (typedConnection) {
      setProvider(typedConnection.provider);
      setSourceUrl(typedConnection.source_url);
      setLastSyncAt(typedConnection.last_synced_at);
      setIsConnected(true);
    } else {
      setLastSyncAt(null);
      setIsConnected(false);
    }

    const nowIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: eventRows, error: eventsError } = await supabase
      .from("family_calendar_events")
      .select("id, title, location, start_at, end_at, is_all_day")
      .eq("family_id", familyId)
      // Include events that have an end date in range OR events without end date but starting in range.
      .or(`end_at.gte.${nowIso},and(end_at.is.null,start_at.gte.${nowIso})`)
      .order("start_at", { ascending: true })
      .limit(25);

    if (eventsError) {
      setErrorMessage("Impossible de charger les événements synchronisés.");
      setIsLoading(false);
      return;
    }

    setEvents((eventRows ?? []) as EventRow[]);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadCalendarData();
  }, []);

  useEffect(() => {
    if (!isConnected || !family?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void triggerSync(false);
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isConnected, family?.id]);

  const triggerSync = async (force: boolean) => {
    setIsSyncing(true);
    setErrorMessage(null);

    const response = await fetch("/api/family-calendar/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      status?: string;
      imported?: number;
      detected?: number;
      ignored?: number;
      ignoredDetails?: {
        missingStart?: number;
      };
      error?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.error ?? "Échec de synchronisation.");
      setIsSyncing(false);
      return;
    }

    if (payload.status === "skipped") {
      setMessage("Synchro déjà récente pour la famille.");
    } else {
      const imported = payload.imported ?? 0;
      const detected = payload.detected ?? imported;
      const ignored = payload.ignored ?? Math.max(detected - imported, 0);
      const ignoredMissingStart = payload.ignoredDetails?.missingStart ?? 0;

      const details =
        ignored > 0
          ? `, ignorés: ${ignored} (sans date de début: ${ignoredMissingStart})`
          : "";

      setMessage(`Synchro terminée. Détectés: ${detected}, importés: ${imported}${details}.`);
    }

    await loadCalendarData();
    setIsSyncing(false);
  };

  const handleConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const cleanUrl = sourceUrl.trim();
    if (!cleanUrl) {
      setErrorMessage("Ajoutez l'URL du calendrier à synchroniser.");
      return;
    }

    if (!family) {
      setErrorMessage("Aucune famille active.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Session invalide.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("family_calendar_connections").upsert(
      {
        family_id: family.id,
        provider,
        source_url: cleanUrl,
        is_read_only: true,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "family_id",
      },
    );

    if (error) {
      setErrorMessage(`Impossible d'enregistrer la connexion: ${error.message}`);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    await triggerSync(true);
  };

  const handleDisconnect = async () => {
    if (!family) {
      return;
    }

    const { error } = await supabase
      .from("family_calendar_connections")
      .delete()
      .eq("family_id", family.id);

    if (error) {
      setErrorMessage(`Impossible de supprimer la connexion: ${error.message}`);
      return;
    }

    setSourceUrl("");
    setLastSyncAt(null);
    setEvents([]);
    setIsConnected(false);
    setMessage("Connexion du calendrier partagé supprimée pour la famille.");
    setErrorMessage(null);
  };

  const lastSyncDisplay = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Jamais";

  const monthLabel = monthCursor.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekCursor, index));
  }, [weekCursor]);

  const weekLabel = `${weekDays[0]?.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  })} - ${weekDays[6]?.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthCursor);
    const gridStart = startOfWeekMonday(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [monthCursor]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, EventRow[]>();

    for (const eventRow of events) {
      const key = dateKey(new Date(eventRow.start_at));
      const existing = grouped.get(key) ?? [];
      existing.push(eventRow);
      grouped.set(key, existing);
    }

    for (const [, dayEvents] of grouped) {
      dayEvents.sort((a, b) => a.start_at.localeCompare(b.start_at));
    }

    return grouped;
  }, [events]);

  return (
    <section className="bg-white rounded-lg shadow-md p-6">
      {showManagementPanel ? (
        <>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Calendrier partagé (lecture seule)</h2>
          <p className="text-slate-600 mb-5">
            Connectez un agenda externe pour consulter les événements dans Easy-Life. Cette connexion est partagée
            automatiquement avec tous les membres de la famille active.
          </p>

          <form onSubmit={handleConnect} className="grid md:grid-cols-3 gap-3">
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as ExternalCalendarConfig["provider"])}
              className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="google">Google Calendar</option>
              <option value="outlook">Outlook Calendar</option>
              <option value="ical">Flux iCal</option>
            </select>

            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://... (URL de partage)"
              className="md:col-span-2 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="md:col-span-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                {isSaving ? "Enregistrement..." : isConnected ? "Mettre à jour la connexion" : "Connecter le calendrier"}
              </button>
              {isConnected ? (
                <button
                  type="button"
                  onClick={() => void triggerSync(true)}
                  disabled={isSyncing || isLoading}
                  className="bg-stone-700 hover:bg-stone-800 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  {isSyncing ? "Synchronisation..." : "Synchroniser maintenant"}
                </button>
              ) : null}
              {isConnected ? (
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  Déconnecter
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-5 grid md:grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 rounded border border-slate-200 p-3">
              <p className="text-slate-500">Statut</p>
              <p className="font-medium text-slate-800">{isConnected ? "Connecté" : "Non connecté"}</p>
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-3">
              <p className="text-slate-500">Partage famille</p>
              <p className="font-medium text-slate-800">
                {family ? `${membersCount} membre(s) de ${family.name}` : "Aucune famille"}
              </p>
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-3">
              <p className="text-slate-500">Source active</p>
              <p className="font-medium text-slate-800">{isConnected ? providerLabel[provider] : "Aucune"}</p>
            </div>
            <div className="bg-slate-50 rounded border border-slate-200 p-3">
              <p className="text-slate-500">Dernière synchro</p>
              <p className="font-medium text-slate-800">{lastSyncDisplay}</p>
              <p className="text-xs text-slate-500 mt-1">Auto: toutes les heures (si cette page reste ouverte)</p>
            </div>
          </div>
        </>
      ) : null}

      <div className={showManagementPanel ? "mt-6" : ""}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Événements synchronisés (lecture seule)</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Calendrier
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                viewMode === "week"
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Semaine
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun événement synchronisé pour le moment.</p>
        ) : viewMode === "list" ? (
          <ul className="space-y-2">
            {events.map((eventRow) => (
              <li key={eventRow.id} className="border border-slate-200 rounded p-3 bg-slate-50">
                <p className="font-medium text-slate-800">{eventRow.title}</p>
                <p className="text-sm text-slate-600">
                  {new Date(eventRow.start_at).toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: eventRow.is_all_day ? undefined : "short",
                  })}
                  {eventRow.end_at
                    ? ` -> ${new Date(eventRow.end_at).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: eventRow.is_all_day ? undefined : "short",
                      })}`
                    : ""}
                </p>
                {eventRow.location ? <p className="text-sm text-slate-500">Lieu: {eventRow.location}</p> : null}
              </li>
            ))}
          </ul>
        ) : viewMode === "calendar" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMonthCursor((previous) => startOfMonth(addMonths(previous, -1)))}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              >
                Mois précédent
              </button>
              <p className="text-sm font-semibold text-slate-700 capitalize">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setMonthCursor((previous) => startOfMonth(addMonths(previous, 1)))}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              >
                Mois suivant
              </button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[920px] grid grid-cols-7 gap-2">
                {[
                  "Lun",
                  "Mar",
                  "Mer",
                  "Jeu",
                  "Ven",
                  "Sam",
                  "Dim",
                ].map((dayLabel) => (
                  <div key={dayLabel} className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2">
                    {dayLabel}
                  </div>
                ))}

                {calendarDays.map((day) => {
                  const key = dateKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const isCurrentMonth = day.getMonth() === monthCursor.getMonth();

                  return (
                    <div
                      key={key}
                      className={`min-h-[120px] rounded border p-2 ${
                        isCurrentMonth ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <p className={`text-xs font-semibold ${isCurrentMonth ? "text-slate-700" : "text-slate-400"}`}>
                        {day.getDate()}
                      </p>

                      {dayEvents.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((eventRow) => (
                            <li key={eventRow.id} className="text-[11px] rounded bg-rose-50 text-rose-700 px-1.5 py-1">
                              {!eventRow.is_all_day
                                ? `${new Date(eventRow.start_at).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })} `
                                : ""}
                              {eventRow.title}
                            </li>
                          ))}
                          {dayEvents.length > 3 ? (
                            <li className="text-[11px] text-slate-500">+ {dayEvents.length - 3} autre(s)</li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setWeekCursor((previous) => startOfWeekMonday(addDays(previous, -7)))}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              >
                Semaine précédente
              </button>
              <p className="text-sm font-semibold text-slate-700">{weekLabel}</p>
              <button
                type="button"
                onClick={() => setWeekCursor((previous) => startOfWeekMonday(addDays(previous, 7)))}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              >
                Semaine suivante
              </button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[920px] grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const key = dateKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];

                  return (
                    <div key={key} className="min-h-[140px] rounded border border-slate-200 bg-white p-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 mb-2">
                        {day.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                      </p>

                      {dayEvents.length > 0 ? (
                        <ul className="space-y-1">
                          {dayEvents.map((eventRow) => (
                            <li key={eventRow.id} className="text-[11px] rounded bg-rose-50 text-rose-700 px-1.5 py-1">
                              {!eventRow.is_all_day
                                ? `${new Date(eventRow.start_at).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })} `
                                : ""}
                              {eventRow.title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400">Aucun événement</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {message ? (
        <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{message}</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{errorMessage}</p>
      ) : null}
    </section>
  );
}
