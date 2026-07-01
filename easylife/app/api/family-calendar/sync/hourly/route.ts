import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SyncBody = {
  force?: boolean;
};

type ParsedIcsEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: Date;
  end?: Date;
  isAllDay: boolean;
  lastModified?: Date;
};

type ParseIcsResult = {
  events: ParsedIcsEvent[];
  detectedCount: number;
  ignoredMissingStartCount: number;
};

type CalendarConnectionRow = {
  id: string;
  family_id: string;
  source_url: string;
  last_synced_at: string | null;
};

const MAX_SYNC_AGE_MINUTES = 60;

const toJsonSafeValue = (input: unknown, seen = new WeakSet<object>()): unknown => {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === "bigint") {
    return input.toString();
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (Array.isArray(input)) {
    return input.map((item) => toJsonSafeValue(item, seen));
  }

  if (typeof input === "object") {
    if (seen.has(input)) {
      return "[Circular]";
    }

    seen.add(input);
    const entries = Object.entries(input as Record<string, unknown>);
    const mappedEntries = entries.map(([key, value]) => [key, toJsonSafeValue(value, seen)]);
    return Object.fromEntries(mappedEntries);
  }

  if (typeof input === "function" || typeof input === "symbol") {
    return String(input);
  }

  return input;
};

const unescapeIcsText = (input: string) =>
  input
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");

const parseIcsDate = (rawValue: string, isDateOnly: boolean): Date | undefined => {
  const value = rawValue.trim();

  if (isDateOnly) {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (!match) {
      return undefined;
    }

    const [, y, m, d] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0));
  }

  const utcMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
  }

  const localMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  }

  const fallbackDate = new Date(value);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return undefined;
};

const parseIcsEvents = (content: string): ParseIcsResult => {
  const unfolded = content.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: ParsedIcsEvent[] = [];
  let detectedCount = 0;
  let ignoredMissingStartCount = 0;
  let current: ParsedIcsEvent | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line === "BEGIN:VEVENT") {
      detectedCount += 1;
      current = { isAllDay: false };
      continue;
    }

    if (line === "END:VEVENT") {
      if (current?.start instanceof Date) {
        events.push(current);
      } else if (current) {
        ignoredMissingStartCount += 1;
      }
      current = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const rawKey = line.slice(0, separatorIndex);
    const rawValue = line.slice(separatorIndex + 1);
    const [key, ...paramParts] = rawKey.split(";");
    const upperKey = key.toUpperCase();
    const params = Object.fromEntries(
      paramParts
        .map((part) => part.split("="))
        .filter((entry) => entry.length === 2)
        .map(([k, v]) => [k.toUpperCase(), v]),
    );

    if (upperKey === "UID") {
      current.uid = rawValue.trim();
    } else if (upperKey === "SUMMARY") {
      current.summary = unescapeIcsText(rawValue.trim());
    } else if (upperKey === "DESCRIPTION") {
      current.description = unescapeIcsText(rawValue.trim());
    } else if (upperKey === "LOCATION") {
      current.location = unescapeIcsText(rawValue.trim());
    } else if (upperKey === "LAST-MODIFIED") {
      current.lastModified = parseIcsDate(rawValue, false);
    } else if (upperKey === "DTSTART") {
      const isDateOnly = (params.VALUE ?? "").toUpperCase() === "DATE";
      current.isAllDay = isDateOnly;
      current.start = parseIcsDate(rawValue, isDateOnly);
    } else if (upperKey === "DTEND") {
      const isDateOnly = (params.VALUE ?? "").toUpperCase() === "DATE";
      current.end = parseIcsDate(rawValue, isDateOnly);
    }
  }

  return {
    events,
    detectedCount,
    ignoredMissingStartCount,
  };
};

const isSyncStillFresh = (lastSyncedAt: string | null | undefined) => {
  if (!lastSyncedAt) {
    return false;
  }

  const last = new Date(lastSyncedAt).getTime();
  const now = Date.now();
  const deltaMs = now - last;

  return deltaMs < MAX_SYNC_AGE_MINUTES * 60 * 1000;
};

const syncConnection = async (connection: CalendarConnectionRow) => {
  const supabase = createAdminClient();

  const response = await fetch(connection.source_url, {
    cache: "no-store",
    headers: {
      "User-Agent": "easy-life-calendar-sync-hourly/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status} pour la connexion ${connection.id}.`);
  }

  const icsContent = await response.text();
  const parsedResult = parseIcsEvents(icsContent);
  const parsedEvents = parsedResult.events;

  const upsertRows: Array<{
    family_id: string;
    connection_id: string;
    external_id: string;
    title: string;
    description: string | null;
    location: string | null;
    start_at: string;
    end_at: string | null;
    is_all_day: boolean;
    source_updated_at: string | null;
    raw_payload: Record<string, unknown>;
    updated_at: string;
  }> = [];

  for (const event of parsedEvents) {
    if (!(event.start instanceof Date)) {
      continue;
    }

    const externalId =
      event.uid && event.uid.trim().length > 0
        ? event.uid
        : `${event.summary ?? "event"}-${event.start.toISOString()}`;

    upsertRows.push({
      family_id: connection.family_id,
      connection_id: connection.id,
      external_id: externalId,
      title: (event.summary ?? "Evenement sans titre").slice(0, 500),
      description: event.description ?? null,
      location: event.location ?? null,
      start_at: event.start.toISOString(),
      end_at: event.end instanceof Date ? event.end.toISOString() : null,
      is_all_day: event.isAllDay,
      source_updated_at: event.lastModified instanceof Date ? event.lastModified.toISOString() : null,
      raw_payload:
        (toJsonSafeValue({
          uid: event.uid ?? null,
          summary: event.summary ?? null,
          description: event.description ?? null,
          location: event.location ?? null,
          start: event.start.toISOString(),
          end: event.end instanceof Date ? event.end.toISOString() : null,
          isAllDay: event.isAllDay,
          lastModified: event.lastModified instanceof Date ? event.lastModified.toISOString() : null,
        }) as Record<string, unknown>) ?? {},
      updated_at: new Date().toISOString(),
    });
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("family_calendar_events")
      .upsert(upsertRows, { onConflict: "connection_id,external_id" });

    if (upsertError) {
      throw new Error(`Erreur upsert événements: ${upsertError.message}`);
    }
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("family_calendar_events")
    .select("external_id")
    .eq("connection_id", connection.id);

  if (existingError) {
    throw new Error(`Erreur lecture événements existants: ${existingError.message}`);
  }

  const newIds = new Set(upsertRows.map((row) => row.external_id));
  const staleIds = (existingRows ?? [])
    .map((row) => row.external_id as string)
    .filter((externalId) => !newIds.has(externalId));

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("family_calendar_events")
      .delete()
      .eq("connection_id", connection.id)
      .in("external_id", staleIds);

    if (deleteError) {
      throw new Error(`Erreur suppression événements obsolètes: ${deleteError.message}`);
    }
  }

  const { error: updateConnectionError } = await supabase
    .from("family_calendar_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "ok",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .eq("family_id", connection.family_id);

  if (updateConnectionError) {
    throw new Error(`Erreur mise à jour connexion: ${updateConnectionError.message}`);
  }

  return {
    imported: upsertRows.length,
    detected: parsedResult.detectedCount,
    ignored: Math.max(parsedResult.detectedCount - upsertRows.length, 0),
  };
};

export async function POST(request: Request) {
  const cronToken = process.env.CALENDAR_SYNC_CRON_TOKEN;
  const authHeader = request.headers.get("authorization") ?? "";

  if (!cronToken) {
    return NextResponse.json({ error: "CALENDAR_SYNC_CRON_TOKEN manquant côté serveur." }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronToken}`) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 401 });
  }

  const body = ((await request.json().catch(() => ({}))) as SyncBody) ?? {};
  const force = body.force === true;

  const supabase = createAdminClient();

  const { data: connections, error: connectionsError } = await supabase
    .from("family_calendar_connections")
    .select("id, family_id, source_url, last_synced_at");

  if (connectionsError) {
    return NextResponse.json({ error: `Impossible de lire les connexions: ${connectionsError.message}` }, { status: 500 });
  }

  const rows = (connections ?? []) as CalendarConnectionRow[];

  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  let totalImported = 0;
  let totalDetected = 0;
  let totalIgnored = 0;
  const errors: string[] = [];

  for (const connection of rows) {
    processed += 1;

    if (!force && isSyncStillFresh(connection.last_synced_at)) {
      skipped += 1;
      continue;
    }

    try {
      const result = await syncConnection(connection);
      synced += 1;
      totalImported += result.imported;
      totalDetected += result.detected;
      totalIgnored += result.ignored;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      errors.push(`Connexion ${connection.id}: ${message}`);

      await supabase
        .from("family_calendar_connections")
        .update({
          last_sync_status: "error",
          last_sync_error: message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id)
        .eq("family_id", connection.family_id);
    }
  }

  return NextResponse.json(
    {
      status: "ok",
      processed,
      synced,
      skipped,
      failed,
      totals: {
        imported: totalImported,
        detected: totalDetected,
        ignored: totalIgnored,
      },
      errors,
    },
    { status: 200 },
  );
}
