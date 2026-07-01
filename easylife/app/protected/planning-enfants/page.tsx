"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type FamilyInfo = {
  id: string;
  name: string;
};

type FamilyPayload = FamilyInfo | FamilyInfo[] | null;

type ChildRow = {
  id: string;
  name: string;
  birth_date: string | null;
  color: string;
};

type PlanningEventRow = {
  id: string;
  child_id: string;
  title: string;
  category: "sport" | "ecole" | "club" | "pick_up_time" | "autre";
  notes: string | null;
  start_at: string;
  end_at: string;
};

type Child = {
  id: string;
  name: string;
  birthDate: string | null;
  color: string;
};

type PlanningEvent = {
  id: string;
  childId: string;
  title: string;
  category: "sport" | "ecole" | "club" | "pick_up_time" | "autre";
  notes: string | null;
  startAt: string;
  endAt: string;
};

type FamilyMembershipRow = {
  family_id?: string | null;
  family: FamilyPayload;
};

type EventTimeMode = "manual-end" | "duration";
type PlanningViewMode = "list" | "week";
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type ActivityCategory = "sport" | "ecole" | "club" | "pick_up_time" | "autre";

const REFERENCE_WEEK_START = "2000-01-03";
const ALL_CHILDREN_FILTER = "all";

const parseFamily = (value: FamilyPayload): FamilyInfo | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const weekdayOrder: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const weekdayLabel: Record<Weekday, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

const categoryLabel: Record<ActivityCategory, string> = {
  sport: "Sport",
  ecole: "École",
  club: "Club",
  pick_up_time: "Pick up time",
  autre: "Autre",
};

const categoryClasses: Record<ActivityCategory, string> = {
  sport: "bg-sky-100 text-sky-700 border-sky-200",
  ecole: "bg-emerald-100 text-emerald-700 border-emerald-200",
  club: "bg-amber-100 text-amber-700 border-amber-200",
  pick_up_time: "bg-violet-100 text-violet-700 border-violet-200",
  autre: "bg-slate-100 text-slate-700 border-slate-200",
};

const toWeekday = (date: Date): Weekday => {
  const day = date.getDay();
  const mapped = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day] as Weekday;
  return mapped;
};

const minutesFromDate = (date: Date) => date.getHours() * 60 + date.getMinutes();

const minutesFromTime = (time: string) => {
  const [h, m] = time.split(":").map((value) => Number.parseInt(value, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }
  return h * 60 + m;
};

const timeFromMinutes = (minutes: number) => {
  const safeMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const m = String(safeMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const buildReferenceDateFromWeekdayAndTime = (weekday: Weekday, time: string) => {
  const weekdayIndex = weekdayOrder.indexOf(weekday);
  const date = new Date(`${REFERENCE_WEEK_START}T00:00:00`);
  date.setDate(date.getDate() + weekdayIndex);

  const totalMinutes = minutesFromTime(time);
  if (totalMinutes === null) {
    return null;
  }

  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return date;
};

const getEventGroupKey = (planningEvent: PlanningEvent) => {
  return [planningEvent.title, planningEvent.category, planningEvent.notes ?? "", planningEvent.startAt, planningEvent.endAt].join("|");
};

export default function ChildrenPlanningPage() {
  const supabase = useMemo(() => createClient(), []);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [selectedEventChildIds, setSelectedEventChildIds] = useState<string[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategory, setEventCategory] = useState<ActivityCategory>("ecole");
  const [eventNotes, setEventNotes] = useState("");
  const [eventWeekday, setEventWeekday] = useState<Weekday>("monday");
  const [eventStartTime, setEventStartTime] = useState("08:00");
  const [eventEndTime, setEventEndTime] = useState("09:00");
  const [eventTimeMode, setEventTimeMode] = useState<EventTimeMode>("manual-end");
  const [eventDurationMinutes, setEventDurationMinutes] = useState("60");
  const [planningViewMode, setPlanningViewMode] = useState<PlanningViewMode>("list");
  const [planningChildFilter, setPlanningChildFilter] = useState<string>(ALL_CHILDREN_FILTER);
  const [planningSearch, setPlanningSearch] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventIds, setEditingEventIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPlanning = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    setErrorMessage(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Impossible de récupérer votre session utilisateur.");
      setIsLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: membershipRows, error: membershipError } = await supabase
      .from("family_members")
      .select("family_id, family:families(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1);

    if (membershipError) {
      setErrorMessage("Impossible de charger la famille active.");
      setIsLoading(false);
      return;
    }

    const membership = (membershipRows?.[0] as FamilyMembershipRow | undefined) ?? undefined;
    let activeFamily = parseFamily(membership?.family ?? null);
    let activeFamilyId = activeFamily?.id ?? membership?.family_id ?? null;

    if (!activeFamilyId) {
      const { data: fallbackFamilyId, error: fallbackError } = await supabase.rpc("user_family_id");
      if (!fallbackError && fallbackFamilyId) {
        activeFamilyId = fallbackFamilyId as string;
      }
    }

    if (!activeFamily && activeFamilyId) {
      const { data: familyRow, error: familyError } = await supabase
        .from("families")
        .select("id, name")
        .eq("id", activeFamilyId)
        .single();

      if (!familyError && familyRow) {
        activeFamily = {
          id: familyRow.id,
          name: familyRow.name,
        };
      }
    }

    setFamily(activeFamily);

    if (!activeFamily) {
      setChildren([]);
      setEvents([]);
      setErrorMessage("Aucune famille active. Créez ou rejoignez une famille.");
      setIsLoading(false);
      return;
    }

    const { data: childRows, error: childrenError } = await supabase
      .from("family_children")
      .select("id, name, birth_date, color")
      .eq("family_id", activeFamily.id)
      .order("created_at", { ascending: true });

    if (childrenError) {
      setErrorMessage("La table family_children est introuvable ou inaccessible.");
      setIsLoading(false);
      return;
    }

    const mappedChildren = ((childRows ?? []) as ChildRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      birthDate: row.birth_date,
      color: row.color,
    }));

    setChildren(mappedChildren);
    setSelectedEventChildIds((previous) => {
      const mappedChildIds = mappedChildren.map((child) => child.id);
      const kept = previous.filter((childId) => mappedChildIds.includes(childId));

      if (kept.length > 0) {
        return kept;
      }

      return mappedChildren[0]?.id ? [mappedChildren[0].id] : [];
    });

    const { data: eventRows, error: eventsError } = await supabase
      .from("family_child_planning_events")
      .select("id, child_id, title, category, notes, start_at, end_at")
      .eq("family_id", activeFamily.id)
      .order("start_at", { ascending: true });

    if (eventsError) {
      setErrorMessage("La table family_child_planning_events est introuvable ou inaccessible.");
      setIsLoading(false);
      return;
    }

    setEvents(
      ((eventRows ?? []) as PlanningEventRow[]).map((row) => ({
        id: row.id,
        childId: row.child_id,
        title: row.title,
        category: row.category,
        notes: row.notes,
        startAt: row.start_at,
        endAt: row.end_at,
      })),
    );

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadPlanning();
  }, [loadPlanning]);

  useEffect(() => {
    if (eventTimeMode !== "duration") {
      return;
    }

    const startMinutes = minutesFromTime(eventStartTime);
    const duration = Number.parseInt(eventDurationMinutes, 10);
    if (startMinutes === null || Number.isNaN(duration) || duration <= 0) {
      setEventEndTime("");
      return;
    }

    setEventEndTime(timeFromMinutes(startMinutes + duration));
  }, [eventDurationMinutes, eventStartTime, eventTimeMode]);

  const toggleEventChildSelection = (childId: string) => {
    setSelectedEventChildIds((previous) =>
      previous.includes(childId) ? previous.filter((id) => id !== childId) : [...previous, childId],
    );
  };

  const handleStartEditEvent = (planningEvent: PlanningEvent) => {
    const startDate = new Date(planningEvent.startAt);
    const endDate = new Date(planningEvent.endAt);

    const startMinutes = minutesFromDate(startDate);
    const endMinutes = minutesFromDate(endDate);
    const computedDuration = Math.max(1, endMinutes - startMinutes);

    const groupedEvents = events.filter(
      (item) =>
        item.title === planningEvent.title &&
        item.category === planningEvent.category &&
        (item.notes ?? "") === (planningEvent.notes ?? "") &&
        item.startAt === planningEvent.startAt &&
        item.endAt === planningEvent.endAt,
    );

    const groupedEventIds = groupedEvents.map((item) => item.id);
    const groupedChildIds = [...new Set(groupedEvents.map((item) => item.childId))];

    setEditingEventId(planningEvent.id);
    setEditingEventIds(groupedEventIds.length > 0 ? groupedEventIds : [planningEvent.id]);
    setEventTitle(planningEvent.title);
    setEventCategory(planningEvent.category);
    setEventNotes(planningEvent.notes ?? "");
    setEventWeekday(toWeekday(startDate));
    setEventStartTime(timeFromMinutes(startMinutes));
    setEventEndTime(timeFromMinutes(endMinutes));
    setEventDurationMinutes(String(computedDuration));
    setEventTimeMode("manual-end");
    setSelectedEventChildIds(groupedChildIds.length > 0 ? groupedChildIds : [planningEvent.childId]);
    setMessage(null);
    setErrorMessage(null);
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEditingEventIds([]);
    setEventTitle("");
    setEventCategory("ecole");
    setEventNotes("");
    setEventWeekday("monday");
    setEventStartTime("08:00");
    setEventEndTime("09:00");
    setEventDurationMinutes("60");
    setEventTimeMode("manual-end");
  };

  const handleAddEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const cleanTitle = eventTitle.trim();
    if (!cleanTitle || !family || selectedEventChildIds.length === 0 || !userId || !eventStartTime) {
      setErrorMessage("Remplissez tous les champs obligatoires de l'événement.");
      return;
    }

    let effectiveEventEndTime = eventEndTime;

    if (eventTimeMode === "duration") {
      const duration = Number.parseInt(eventDurationMinutes, 10);
      if (Number.isNaN(duration) || duration <= 0) {
        setErrorMessage("La durée doit être un nombre de minutes supérieur à 0.");
        return;
      }

      const startMinutes = minutesFromTime(eventStartTime);
      if (startMinutes === null) {
        setErrorMessage("Heure de début invalide.");
        return;
      }

      effectiveEventEndTime = timeFromMinutes(startMinutes + duration);
      setEventEndTime(effectiveEventEndTime);
    }

    if (!effectiveEventEndTime) {
      setErrorMessage("Remplissez tous les champs obligatoires de l'événement.");
      return;
    }

    const startDate = buildReferenceDateFromWeekdayAndTime(eventWeekday, eventStartTime);
    const endDate = buildReferenceDateFromWeekdayAndTime(eventWeekday, effectiveEventEndTime);

    if (!startDate || !endDate) {
      setErrorMessage("Heures invalides.");
      return;
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    if (new Date(endIso) <= new Date(startIso)) {
      setErrorMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    setIsSavingEvent(true);

    if (editingEventId) {
      const cleanedNotes = eventNotes.trim() || null;
      const baseGroupEvents = events.filter((item) => editingEventIds.includes(item.id));
      const fallbackEvent = events.find((item) => item.id === editingEventId);
      const targetGroup = baseGroupEvents.length > 0 ? baseGroupEvents : fallbackEvent ? [fallbackEvent] : [];

      if (targetGroup.length === 0) {
        setErrorMessage("Impossible de retrouver l'événement à modifier.");
        setIsSavingEvent(false);
        return;
      }

      const currentChildIds = [...new Set(targetGroup.map((item) => item.childId))];
      const toDeleteIds = targetGroup
        .filter((item) => !selectedEventChildIds.includes(item.childId))
        .map((item) => item.id);
      const toKeepIds = targetGroup
        .filter((item) => selectedEventChildIds.includes(item.childId))
        .map((item) => item.id);
      const toAddChildIds = selectedEventChildIds.filter((childId) => !currentChildIds.includes(childId));

      let updatedRows: PlanningEventRow[] = [];
      let insertedRows: PlanningEventRow[] = [];

      if (toKeepIds.length > 0) {
        const { data: updatedData, error: updateError } = await supabase
          .from("family_child_planning_events")
          .update({
            category: eventCategory,
            title: cleanTitle,
            notes: cleanedNotes,
            start_at: startIso,
            end_at: endIso,
          })
          .in("id", toKeepIds)
          .select("id, child_id, title, category, notes, start_at, end_at");

        if (updateError) {
          setErrorMessage(updateError.message ?? "Impossible de modifier l'événement.");
          setIsSavingEvent(false);
          return;
        }

        updatedRows = (updatedData ?? []) as PlanningEventRow[];
      }

      if (toDeleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("family_child_planning_events")
          .delete()
          .in("id", toDeleteIds);

        if (deleteError) {
          setErrorMessage(deleteError.message ?? "Impossible de modifier l'événement.");
          setIsSavingEvent(false);
          return;
        }
      }

      if (toAddChildIds.length > 0) {
        const rowsToInsert = toAddChildIds.map((childId) => ({
          family_id: family.id,
          child_id: childId,
          category: eventCategory,
          title: cleanTitle,
          notes: cleanedNotes,
          start_at: startIso,
          end_at: endIso,
          created_by: userId,
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from("family_child_planning_events")
          .insert(rowsToInsert)
          .select("id, child_id, title, category, notes, start_at, end_at");

        if (insertError) {
          setErrorMessage(insertError.message ?? "Impossible de modifier l'événement.");
          setIsSavingEvent(false);
          return;
        }

        insertedRows = (insertedData ?? []) as PlanningEventRow[];
      }

      const updatedRowsById = new Map(
        updatedRows.map((row) => [
          row.id,
          {
            id: row.id,
            childId: row.child_id,
            title: row.title,
            category: row.category,
            notes: row.notes,
            startAt: row.start_at,
            endAt: row.end_at,
          } as PlanningEvent,
        ]),
      );

      const insertedEvents: PlanningEvent[] = insertedRows.map((row) => ({
        id: row.id,
        childId: row.child_id,
        title: row.title,
        category: row.category,
        notes: row.notes,
        startAt: row.start_at,
        endAt: row.end_at,
      }));

      setEvents((previous) => {
        const next = previous
          .filter((item) => !toDeleteIds.includes(item.id))
          .map((item) => updatedRowsById.get(item.id) ?? item);

        return [...next, ...insertedEvents].sort((a, b) => a.startAt.localeCompare(b.startAt));
      });

      resetEventForm();
      setMessage("Événement modifié.");
      setIsSavingEvent(false);
      return;
    }

    const eventRowsToInsert = selectedEventChildIds.map((childId) => ({
      family_id: family.id,
      child_id: childId,
      category: eventCategory,
      title: cleanTitle,
      notes: eventNotes.trim() || null,
      start_at: startIso,
      end_at: endIso,
      created_by: userId,
    }));

    const { data, error } = await supabase
      .from("family_child_planning_events")
      .insert(eventRowsToInsert)
      .select("id, child_id, title, category, notes, start_at, end_at");

    if (error || !data || data.length === 0) {
      setErrorMessage(error?.message ?? "Impossible d'ajouter l'événement.");
      setIsSavingEvent(false);
      return;
    }

    const newEvents: PlanningEvent[] = ((data ?? []) as PlanningEventRow[]).map((row) => ({
      id: row.id,
      childId: row.child_id,
      title: row.title,
      category: row.category,
      notes: row.notes,
      startAt: row.start_at,
      endAt: row.end_at,
    }));

    setEvents((previous) => [...previous, ...newEvents].sort((a, b) => a.startAt.localeCompare(b.startAt)));
    resetEventForm();
    setMessage(`Événement ajouté pour ${newEvents.length} enfant(s).`);
    setIsSavingEvent(false);
  };

  const handleDeleteEvent = async (eventId: string) => {
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("family_child_planning_events").delete().eq("id", eventId);

    if (error) {
      setErrorMessage("Impossible de supprimer cet événement.");
      return;
    }

    setEvents((previous) => previous.filter((planningEvent) => planningEvent.id !== eventId));
    setMessage("Événement supprimé.");
  };

  const eventsForFilteredChildren = useMemo(() => {
    if (planningChildFilter === ALL_CHILDREN_FILTER) {
      return events;
    }
    return events.filter((planningEvent) => planningEvent.childId === planningChildFilter);
  }, [events, planningChildFilter]);

  const normalizedPlanningSearch = planningSearch.trim().toLowerCase();

  const childById = useMemo(() => {
    return new Map(children.map((child) => [child.id, child]));
  }, [children]);

  const filteredEventsForPlanning = useMemo(() => {
    if (!normalizedPlanningSearch) {
      return eventsForFilteredChildren;
    }

    return eventsForFilteredChildren.filter((planningEvent) => {
      const childName = childById.get(planningEvent.childId)?.name?.toLowerCase() ?? "";
      return (
        planningEvent.title.toLowerCase().includes(normalizedPlanningSearch) ||
        (planningEvent.notes ?? "").toLowerCase().includes(normalizedPlanningSearch) ||
        childName.includes(normalizedPlanningSearch)
      );
    });
  }, [childById, eventsForFilteredChildren, normalizedPlanningSearch]);

  const eventsForPlanningSorted = useMemo(() => {
    return [...filteredEventsForPlanning].sort((a, b) => {
      const aDate = new Date(a.startAt);
      const bDate = new Date(b.startAt);
      const weekdayDiff = weekdayOrder.indexOf(toWeekday(aDate)) - weekdayOrder.indexOf(toWeekday(bDate));
      if (weekdayDiff !== 0) {
        return weekdayDiff;
      }
      return minutesFromDate(aDate) - minutesFromDate(bDate);
    });
  }, [filteredEventsForPlanning]);

  const groupedChildrenByEventKey = useMemo(() => {
    const grouped = new Map<string, string[]>();

    for (const planningEvent of events) {
      const key = getEventGroupKey(planningEvent);
      const childName = childById.get(planningEvent.childId)?.name;

      if (!childName) {
        continue;
      }

      const existing = grouped.get(key) ?? [];
      if (!existing.includes(childName)) {
        existing.push(childName);
      }
      grouped.set(key, existing);
    }

    return grouped;
  }, [childById, events]);

  const eventsByWeekday = useMemo(() => {
    const grouped = new Map<Weekday, PlanningEvent[]>();
    for (const day of weekdayOrder) {
      grouped.set(day, []);
    }

    for (const planningEvent of events) {
      const weekday = toWeekday(new Date(planningEvent.startAt));
      const existing = grouped.get(weekday);
      if (existing) {
        existing.push(planningEvent);
      }
    }

    for (const day of weekdayOrder) {
      const existing = grouped.get(day) ?? [];
      existing.sort((a, b) => minutesFromDate(new Date(a.startAt)) - minutesFromDate(new Date(b.startAt)));
      grouped.set(day, existing);
    }

    return grouped;
  }, [events]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 flex flex-col gap-6 sm:gap-8">
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-800">Planning des enfants</h1>

        {message ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{message}</p>
        ) : null}
        {errorMessage ? (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{errorMessage}</p>
        ) : null}

        <div className="order-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              {editingEventId ? "Modifier un événement" : "Ajouter un événement"}
            </h2>
            <form onSubmit={handleAddEvent} noValidate className="space-y-3">
              <div className="rounded border border-slate-300 p-3">
                <p className="text-sm font-medium text-slate-700 mb-2">Cette activité concerne :</p>
                {children.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Ajoutez au moins un enfant dans les paramètres du planning.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {children.map((child) => {
                      const isChecked = selectedEventChildIds.includes(child.id);
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => toggleEventChildSelection(child.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                            isChecked
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: child.color }} />
                          {child.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={eventTitle}
                onChange={(inputEvent) => setEventTitle(inputEvent.target.value)}
                placeholder="Titre (école, sport, médecin...)"
                className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />

              <select
                value={eventCategory}
                onChange={(inputEvent) => setEventCategory(inputEvent.target.value as ActivityCategory)}
                className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="ecole">École</option>
                <option value="sport">Sport</option>
                <option value="club">Club</option>
                <option value="pick_up_time">Pick up time</option>
                <option value="autre">Autre</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventTimeMode("manual-end")}
                  className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                    eventTimeMode === "manual-end"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Heure de fin
                </button>
                <button
                  type="button"
                  onClick={() => setEventTimeMode("duration")}
                  className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                    eventTimeMode === "duration"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Durée
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={eventWeekday}
                  onChange={(inputEvent) => setEventWeekday(inputEvent.target.value as Weekday)}
                  className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {weekdayOrder.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {weekdayLabel[weekday]}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={eventStartTime}
                  onChange={(inputEvent) => setEventStartTime(inputEvent.target.value)}
                  className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                {eventTimeMode === "manual-end" ? (
                  <input
                    type="time"
                    value={eventEndTime}
                    onChange={(inputEvent) => setEventEndTime(inputEvent.target.value)}
                    className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={eventDurationMinutes}
                    onChange={(inputEvent) => setEventDurationMinutes(inputEvent.target.value.replace(/\D/g, ""))}
                    placeholder="Durée en minutes"
                    className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                )}
              </div>

              {eventTimeMode === "duration" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {[30, 45, 60, 90, 120].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => {
                          setEventTimeMode("duration");
                          setEventDurationMinutes(String(minutes));
                        }}
                        className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                          eventDurationMinutes === String(minutes)
                            ? "border-rose-500 bg-rose-50 text-rose-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {minutes >= 60 ? `${minutes / 60}h${minutes % 60 === 0 ? "" : ` ${minutes % 60}min`}` : `${minutes} min`}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    Heure de fin calculée automatiquement: {eventEndTime || "--"}
                  </p>
                </div>
              ) : null}

              <textarea
                value={eventNotes}
                onChange={(inputEvent) => setEventNotes(inputEvent.target.value)}
                placeholder="Notes (optionnel)"
                className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
              />

              <button
                type="submit"
                disabled={isSavingEvent || selectedEventChildIds.length === 0}
                className="w-full bg-stone-700 hover:bg-stone-800 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
              >
                {isSavingEvent ? "Enregistrement..." : editingEventId ? "Enregistrer la modification" : "Ajouter l'événement"}
              </button>

              {editingEventId ? (
                <button
                  type="button"
                  onClick={resetEventForm}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  Annuler la modification
                </button>
              ) : null}
            </form>
          </div>

        <div className="order-3 bg-white rounded-lg shadow-md p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-800">Paramètres des enfants</h2>
          <p className="text-sm text-slate-600 mt-2 mb-3">
            L&apos;ajout et la modification des enfants se font dans la section paramètres.
          </p>
          <Link
            href="/protected/parametres/planning-enfants"
            className="inline-flex bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded font-medium transition-colors"
          >
            Gérer dans Paramètres
          </Link>
        </div>

        <div className="order-1 bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800">Planning</h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPlanningViewMode("list")}
                className={`flex-1 sm:flex-none px-3 py-2 rounded border text-sm font-medium transition-colors ${
                  planningViewMode === "list"
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Liste
              </button>
              <button
                type="button"
                onClick={() => setPlanningViewMode("week")}
                className={`flex-1 sm:flex-none px-3 py-2 rounded border text-sm font-medium transition-colors ${
                  planningViewMode === "week"
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Semaine
              </button>
            </div>
          </div>

          <div className="mb-4 space-y-3">
            <div className="overflow-x-auto pb-1">
              <div className="flex items-center gap-2 min-w-max">
                <button
                  type="button"
                  onClick={() => setPlanningChildFilter(ALL_CHILDREN_FILTER)}
                  className={`px-3 py-2 rounded-full border text-sm font-medium transition-colors whitespace-nowrap ${
                    planningChildFilter === ALL_CHILDREN_FILTER
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Tous les enfants
                </button>
                {children.map((child) => {
                  const isSelected = planningChildFilter === child.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setPlanningChildFilter(child.id)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-colors whitespace-nowrap ${
                        isSelected
                          ? "border-rose-500 bg-rose-50 text-rose-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: child.color }} />
                      {child.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <input
              type="search"
              value={planningSearch}
              onChange={(inputEvent) => setPlanningSearch(inputEvent.target.value)}
              placeholder="Rechercher une activité, une note ou un prénom"
              className="w-full sm:w-96 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">Chargement...</p>
          ) : planningViewMode === "list" ? filteredEventsForPlanning.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun événement ne correspond aux filtres actuels.</p>
          ) : (
            <ul className="space-y-3">
              {eventsForPlanningSorted.map((planningEvent) => (
                <li key={planningEvent.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      {(() => {
                        const key = getEventGroupKey(planningEvent);
                        const relatedChildren = groupedChildrenByEventKey.get(key) ?? [];
                        const childrenDisplay = relatedChildren.length > 0 ? relatedChildren.join(", ") : "Inconnu";

                        return (
                          <>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-800">{planningEvent.title}</p>
                              <span
                                className={`text-xs px-2 py-0.5 rounded border font-medium ${categoryClasses[planningEvent.category]}`}
                              >
                                {categoryLabel[planningEvent.category]}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">
                              {weekdayLabel[toWeekday(new Date(planningEvent.startAt))]} {"•"}{" "}
                              {new Date(planningEvent.startAt).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" -> "}
                              {new Date(planningEvent.endAt).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">{childrenDisplay}</p>
                          </>
                        );
                      })()}
                      {planningEvent.notes ? <p className="text-sm text-slate-600 mt-1">{planningEvent.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleStartEditEvent(planningEvent)}
                        className="flex-1 sm:flex-none text-xs bg-sky-100 text-sky-700 hover:bg-sky-200 px-3 py-2 rounded"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteEvent(planningEvent.id)}
                        className="flex-1 sm:flex-none text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-2 rounded"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 font-medium">Semaine type (identique chaque semaine)</p>

              <div className="lg:hidden space-y-3">
                {weekdayOrder.map((weekday) => {
                  const dayEvents = (eventsByWeekday.get(weekday) ?? []).filter((planningEvent) =>
                    filteredEventsForPlanning.some((item) => item.id === planningEvent.id),
                  );

                  return (
                    <section key={`mobile-${weekday}`} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">{weekdayLabel[weekday]}</h3>
                      {dayEvents.length === 0 ? (
                        <p className="text-xs text-slate-400">Aucune activité</p>
                      ) : (
                        <ul className="space-y-2">
                          {dayEvents.map((planningEvent) => {
                            const linkedChild = childById.get(planningEvent.childId);
                            const childColor = linkedChild?.color ?? "#94a3b8";

                            return (
                              <li
                                key={`mobile-card-${planningEvent.id}`}
                                className="rounded border border-slate-200 bg-white p-2 border-l-4"
                                style={{ borderLeftColor: childColor }}
                              >
                                <p className="text-xs font-semibold text-slate-800">{planningEvent.title}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {new Date(planningEvent.startAt).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {" - "}
                                  {new Date(planningEvent.endAt).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditEvent(planningEvent)}
                                    className="text-[10px] bg-sky-100 text-sky-700 hover:bg-sky-200 px-2 py-1 rounded"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteEvent(planningEvent.id)}
                                    className="text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-200 px-2 py-1 rounded"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>

              <div className="hidden lg:block overflow-x-auto">
                <div className="min-w-[980px] grid grid-cols-7 gap-3">
                  {weekdayOrder.map((weekday) => {
                    const dayEvents = (eventsByWeekday.get(weekday) ?? []).filter((planningEvent) =>
                      filteredEventsForPlanning.some((item) => item.id === planningEvent.id),
                    );

                    return (
                      <div key={weekday} className="border border-slate-200 rounded-lg bg-slate-50/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                          {weekdayLabel[weekday]}
                        </p>
                        <p className="text-sm font-semibold text-slate-700 mb-2">Hebdomadaire</p>

                        {dayEvents.length === 0 ? (
                          <p className="text-xs text-slate-400">Aucune activité</p>
                        ) : (
                          <ul className="space-y-2">
                            {dayEvents.map((planningEvent) => {
                              const linkedChild = childById.get(planningEvent.childId);
                              const childColor = linkedChild?.color ?? "#94a3b8";

                              return (
                                <li
                                  key={planningEvent.id}
                                  className="rounded border border-slate-200 bg-white p-2 border-l-4"
                                  style={{ borderLeftColor: childColor }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-800 line-clamp-2">{planningEvent.title}</p>
                                      <span
                                        className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                                          categoryClasses[planningEvent.category]
                                        }`}
                                      >
                                        {categoryLabel[planningEvent.category]}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {new Date(planningEvent.startAt).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    {" - "}
                                    {new Date(planningEvent.endAt).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  {linkedChild ? (
                                    <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: childColor }} />
                                      {linkedChild.name}
                                    </p>
                                  ) : null}
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditEvent(planningEvent)}
                                      className="text-[10px] bg-sky-100 text-sky-700 hover:bg-sky-200 px-1.5 py-0.5 rounded"
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteEvent(planningEvent.id)}
                                      className="text-[10px] bg-rose-100 text-rose-700 hover:bg-rose-200 px-1.5 py-0.5 rounded"
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
