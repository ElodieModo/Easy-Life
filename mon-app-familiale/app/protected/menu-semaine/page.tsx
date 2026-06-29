"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type FamilyInfo = {
  id: string;
  name: string;
};

type FamilyPayload = FamilyInfo | FamilyInfo[] | null;

type FamilyMembershipRow = {
  family_id?: string | null;
  family: FamilyPayload;
};

type ShoppingListRow = {
  id: string;
  name: string;
};

type WeeklyMenuRow = {
  id: string;
  day_of_week: number;
  meal_slot: MealSlot;
  title: string;
  notes: string | null;
  ingredients: string | null;
};

type MenuDraft = {
  title: string;
  notes: string;
  ingredients: string;
};

type MealSlot = "diner";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DINNER_SLOT: MealSlot = "diner";

const slotKey = (dayOfWeek: number, mealSlot: MealSlot) => `${dayOfWeek}-${mealSlot}`;

const parseFamily = (value: FamilyPayload): FamilyInfo | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const getMonday = (source: Date) => {
  const date = new Date(source);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekLabel = (weekStartDateKey: string) => {
  const [year, month, day] = weekStartDateKey.split("-").map(Number);
  const weekStart = new Date(year, month - 1, day);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startLabel = weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const endLabel = weekEnd.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  return `${startLabel} - ${endLabel}`;
};

const normalizeListName = (name: string) =>
  name.trim().toLowerCase() === "liste principale" ? "Notes diverses" : name;

const extractIngredients = (input: string) =>
  input
    .split(/[,\n]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export default function WeeklyMenuPage() {
  const supabase = useMemo(() => createClient(), []);
  const defaultOpenDay = (new Date().getDay() + 6) % 7;

  const [userId, setUserId] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [weekStartDate, setWeekStartDate] = useState(toDateKey(getMonday(new Date())));
  const [rowsByKey, setRowsByKey] = useState<Record<string, WeeklyMenuRow>>({});
  const [draftsByKey, setDraftsByKey] = useState<Record<string, MenuDraft>>({});
  const [shoppingLists, setShoppingLists] = useState<ShoppingListRow[]>([]);
  const [selectedShoppingListId, setSelectedShoppingListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openDayIndex, setOpenDayIndex] = useState<number>(defaultOpenDay);

  const weekLabel = useMemo(() => getWeekLabel(weekStartDate), [weekStartDate]);

  const filledSlotsCount = useMemo(() => {
    return Object.values(rowsByKey).filter((row) => row.title.trim().length > 0).length;
  }, [rowsByKey]);

  const allIngredients = useMemo(() => {
    const set = new Set<string>();
    for (const row of Object.values(rowsByKey)) {
      if (!row.ingredients) {
        continue;
      }
      for (const ingredient of extractIngredients(row.ingredients)) {
        set.add(ingredient);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fr-FR"));
  }, [rowsByKey]);

  const loadFamilyAndLists = async () => {
    setIsLoading(true);
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
      setErrorMessage("Les tables famille ne sont pas disponibles. Exécutez le script SQL family_schema.sql dans Supabase.");
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
      setErrorMessage("Aucune famille active. Créez ou rejoignez une famille dans l'onglet Ma famille.");
      setIsLoading(false);
      return;
    }

    const { data: shoppingListRows } = await supabase
      .from("shopping_lists")
      .select("id, name")
      .eq("family_id", activeFamily.id)
      .order("created_at", { ascending: true });

    const normalizedLists = ((shoppingListRows ?? []) as ShoppingListRow[]).map((row) => ({
      id: row.id,
      name: normalizeListName(row.name),
    }));

    setShoppingLists(normalizedLists);
    setSelectedShoppingListId((previous) => previous ?? normalizedLists[0]?.id ?? null);
    setIsLoading(false);
  };

  const loadWeekRows = async () => {
    if (!family) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("family_weekly_menu_items")
      .select("id, day_of_week, meal_slot, title, notes, ingredients")
      .eq("family_id", family.id)
      .eq("week_start_date", weekStartDate)
      .eq("meal_slot", DINNER_SLOT)
      .order("day_of_week", { ascending: true });

    if (error) {
      setErrorMessage(
        "Le module Menu de la semaine n'est pas encore prêt dans la base. Exécutez la migration supabase/migration_add_weekly_menu.sql.",
      );
      setRowsByKey({});
      setDraftsByKey({});
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as WeeklyMenuRow[];
    const nextRowsByKey: Record<string, WeeklyMenuRow> = {};
    const nextDraftsByKey: Record<string, MenuDraft> = {};

    rows.forEach((row) => {
      const key = slotKey(row.day_of_week, row.meal_slot);
      nextRowsByKey[key] = row;
      nextDraftsByKey[key] = {
        title: row.title,
        notes: row.notes ?? "",
        ingredients: row.ingredients ?? "",
      };
    });

    setRowsByKey(nextRowsByKey);
    setDraftsByKey(nextDraftsByKey);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadFamilyAndLists();
  }, []);

  useEffect(() => {
    void loadWeekRows();
  }, [family, weekStartDate]);

  const updateDraft = (dayOfWeek: number, patch: Partial<MenuDraft>) => {
    const mealSlot = DINNER_SLOT;
    const key = slotKey(dayOfWeek, mealSlot);
    setDraftsByKey((previous) => {
      const current =
        previous[key] ??
        ({
          title: rowsByKey[key]?.title ?? "",
          notes: rowsByKey[key]?.notes ?? "",
          ingredients: rowsByKey[key]?.ingredients ?? "",
        } as MenuDraft);

      return {
        ...previous,
        [key]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const saveSlot = async (dayOfWeek: number) => {
    if (!family || !userId) {
      return;
    }

    const mealSlot = DINNER_SLOT;

    const key = slotKey(dayOfWeek, mealSlot);
    const existing = rowsByKey[key];
    const draft = draftsByKey[key] ?? {
      title: existing?.title ?? "",
      notes: existing?.notes ?? "",
      ingredients: existing?.ingredients ?? "",
    };

    const cleanTitle = draft.title.trim();
    const cleanNotes = draft.notes.trim();
    const cleanIngredients = draft.ingredients.trim();

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);

    if (!cleanTitle && existing?.id) {
      const { error } = await supabase
        .from("family_weekly_menu_items")
        .delete()
        .eq("id", existing.id)
        .eq("family_id", family.id);

      if (error) {
        setErrorMessage("Impossible de supprimer ce dîner.");
        setIsSaving(false);
        return;
      }

      setRowsByKey((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });

      setDraftsByKey((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });

      setMessage("Dîner supprimé.");
      setIsSaving(false);
      return;
    }

    if (!cleanTitle) {
      setErrorMessage("Ajoutez au moins un nom de dîner avant d'enregistrer.");
      setIsSaving(false);
      return;
    }

    const payload = {
      family_id: family.id,
      week_start_date: weekStartDate,
      day_of_week: dayOfWeek,
      meal_slot: mealSlot,
      title: cleanTitle,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
      ingredients: cleanIngredients.length > 0 ? cleanIngredients : null,
      created_by: existing?.id ? undefined : userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("family_weekly_menu_items")
      .upsert(payload, { onConflict: "family_id,week_start_date,day_of_week,meal_slot" })
      .select("id, day_of_week, meal_slot, title, notes, ingredients")
      .single();

    if (error || !data) {
      setErrorMessage("Impossible d'enregistrer ce dîner.");
      setIsSaving(false);
      return;
    }

    const saved = data as WeeklyMenuRow;
    setRowsByKey((previous) => ({
      ...previous,
      [key]: saved,
    }));

    setDraftsByKey((previous) => ({
      ...previous,
      [key]: {
        title: saved.title,
        notes: saved.notes ?? "",
        ingredients: saved.ingredients ?? "",
      },
    }));

    setMessage("Dîner enregistré.");
    setIsSaving(false);
  };

  const shiftWeek = (deltaDays: number) => {
    const [year, month, day] = weekStartDate.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    start.setDate(start.getDate() + deltaDays);
    setWeekStartDate(toDateKey(start));
  };

  const duplicateToNextWeek = async () => {
    if (!family || !userId) {
      return;
    }

    const sourceRows = Object.values(rowsByKey);
    if (sourceRows.length === 0) {
      setErrorMessage("Aucun créneau à copier sur la semaine suivante.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setMessage(null);

    const [year, month, day] = weekStartDate.split("-").map(Number);
    const nextWeekDate = new Date(year, month - 1, day);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekKey = toDateKey(nextWeekDate);

    const payload = sourceRows.map((row) => ({
      family_id: family.id,
      week_start_date: nextWeekKey,
      day_of_week: row.day_of_week,
      meal_slot: row.meal_slot,
      title: row.title,
      notes: row.notes,
      ingredients: row.ingredients,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("family_weekly_menu_items")
      .upsert(payload, { onConflict: "family_id,week_start_date,day_of_week,meal_slot" });

    if (error) {
      setErrorMessage("Impossible de copier vers la semaine suivante.");
      setIsSaving(false);
      return;
    }

    setMessage("Menu copié vers la semaine suivante.");
    setIsSaving(false);
  };

  const exportIngredientsToShoppingList = async (event: FormEvent) => {
    event.preventDefault();

    if (!family || !userId || !selectedShoppingListId) {
      return;
    }

    if (allIngredients.length === 0) {
      setErrorMessage("Aucun ingrédient à exporter depuis le menu de la semaine.");
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setMessage(null);

    const { data: existingRows } = await supabase
      .from("shopping_items")
      .select("name")
      .eq("family_id", family.id)
      .eq("list_id", selectedShoppingListId)
      .eq("done", false);

    const existingNames = new Set(
      ((existingRows ?? []) as Array<{ name: string }>).map((row) => row.name.trim().toLowerCase()),
    );

    const toInsert = allIngredients
      .filter((ingredient) => !existingNames.has(ingredient.trim().toLowerCase()))
      .map((ingredient) => ({
        family_id: family.id,
        list_id: selectedShoppingListId,
        created_by: userId,
        name: ingredient,
        quantity: "1",
        done: false,
      }));

    if (toInsert.length === 0) {
      setMessage("Tous les ingrédients sont déjà présents dans la liste sélectionnée.");
      setIsExporting(false);
      return;
    }

    const { error } = await supabase.from("shopping_items").insert(toInsert);

    if (error) {
      setErrorMessage("Impossible d'exporter les ingrédients vers la liste de courses.");
      setIsExporting(false);
      return;
    }

    setMessage(`${toInsert.length} ingrédient(s) ajouté(s) à la liste de courses.`);
    setIsExporting(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100 text-slate-800">
      <Navbar />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-4 sm:space-y-6">
        <section className="bg-white/85 rounded-2xl border border-rose-100 shadow-sm p-4 sm:p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-800">Menu de la semaine</h1>
              <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-slate-600">
                Planifiez les dîners de la semaine, ajoutez les ingrédients et exportez-les vers vos courses.
              </p>
            </div>
            <Link
              href="/protected/liste-courses"
              className="w-full sm:w-auto text-center text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded border border-slate-200 transition-colors"
            >
              Ouvrir les courses
            </Link>
          </div>

          <div className="mt-6 grid lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => shiftWeek(-7)}
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded border border-slate-200 transition-colors"
              >
                Semaine précédente
              </button>
              <button
                type="button"
                onClick={() => setWeekStartDate(toDateKey(getMonday(new Date())))}
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded border border-slate-200 transition-colors"
              >
                Semaine actuelle
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(7)}
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded border border-slate-200 transition-colors"
              >
                Semaine suivante
              </button>

              <span className="inline-flex items-center justify-center rounded-full bg-rose-100 text-rose-700 px-3 py-1 text-sm font-semibold">
                {weekLabel}
              </span>
            </div>

            <div className="text-sm text-slate-600 lg:text-right">
              <p>
                Famille: <span className="font-semibold text-slate-800">{family?.name ?? "-"}</span>
              </p>
              <p className="mt-1">Dîners remplis: {filledSlotsCount}/7</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={duplicateToNextWeek}
              disabled={isSaving || isLoading || !family}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Copier vers la semaine suivante
            </button>
            <Link
              href="/protected/parametres"
              className="w-full sm:w-auto text-center text-sm bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded border border-slate-200 transition-colors"
            >
              Paramètres
            </Link>
          </div>
        </section>

        {errorMessage ? (
          <section className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">{errorMessage}</section>
        ) : null}

        {message ? (
          <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">{message}</section>
        ) : null}

        <section className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {DAYS.map((dayLabel, dayIndex) => (
            <article key={dayLabel} className="bg-white/85 rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm space-y-3">
              <button
                type="button"
                onClick={() => setOpenDayIndex((previous) => (previous === dayIndex ? -1 : dayIndex))}
                className="w-full flex items-center justify-between text-left sm:cursor-default"
              >
                <h2 className="font-bold text-slate-800">{dayLabel}</h2>
                <span className="sm:hidden text-slate-500 text-sm">{openDayIndex === dayIndex ? "Masquer" : "Ouvrir"}</span>
              </button>

              <div className={`${openDayIndex === dayIndex ? "block" : "hidden"} sm:block`}>
                {(() => {
                const key = slotKey(dayIndex, DINNER_SLOT);
                const draft =
                  draftsByKey[key] ??
                  ({
                    title: rowsByKey[key]?.title ?? "",
                    notes: rowsByKey[key]?.notes ?? "",
                    ingredients: rowsByKey[key]?.ingredients ?? "",
                  } as MenuDraft);

                return (
                  <div className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                    <p className="text-sm font-semibold text-slate-700 mb-2">🍲 Dîner</p>

                    <input
                      type="text"
                      value={draft.title}
                      onChange={(event) => updateDraft(dayIndex, { title: event.target.value })}
                      placeholder="Nom du dîner"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />

                    <textarea
                      value={draft.notes}
                      onChange={(event) => updateDraft(dayIndex, { notes: event.target.value })}
                      placeholder="Notes (préparation, timing, allergies...)"
                      className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 min-h-[72px] focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />

                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => saveSlot(dayIndex)}
                        disabled={isSaving || isLoading || !family}
                        className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 sm:py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                );
                })()}
              </div>
            </article>
          ))}
        </section>

        <section className="bg-white/85 rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Ingrédients de la semaine</h2>
              <p className="text-sm text-slate-600">Préparez rapidement votre liste de courses à partir du menu.</p>
            </div>
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              {allIngredients.length} ingrédient(s)
            </span>
          </div>

          {allIngredients.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Ajoutez des ingrédients dans vos dîners pour les retrouver ici.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {allIngredients.map((ingredient) => (
                <span key={ingredient} className="text-sm bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-slate-700">
                  {ingredient}
                </span>
              ))}
            </div>
          )}

          <form onSubmit={exportIngredientsToShoppingList} className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={selectedShoppingListId ?? ""}
              onChange={(event) => setSelectedShoppingListId(event.target.value || null)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              {shoppingLists.length === 0 ? <option value="">Aucune liste disponible</option> : null}
              {shoppingLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={isExporting || !selectedShoppingListId || allIngredients.length === 0}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? "Export en cours..." : "Ajouter aux courses"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
