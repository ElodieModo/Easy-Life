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

type FamilyMembershipRow = {
  family_id?: string | null;
  family: FamilyPayload;
};

type NoteListVisibility = "family" | "private";

type NoteList = {
  id: string;
  title: string;
  visibility: NoteListVisibility;
  ownerUserId: string | null;
  createdAt: string;
};

type NoteItem = {
  id: string;
  listId: string;
  content: string;
  done: boolean;
  createdAt: string;
};

type NoteListRow = {
  id: string;
  title: string;
  visibility: NoteListVisibility;
  owner_user_id: string | null;
  created_at: string;
};

type NoteItemRow = {
  id: string;
  list_id: string;
  content: string;
  done: boolean;
  created_at: string;
};

const sortListsByStoredOrder = (lists: NoteList[], orderedIds: string[]) => {
  if (orderedIds.length === 0) {
    return lists;
  }

  const mapById = new Map(lists.map((list) => [list.id, list]));
  const orderedLists: NoteList[] = [];

  for (const id of orderedIds) {
    const list = mapById.get(id);
    if (list) {
      orderedLists.push(list);
      mapById.delete(id);
    }
  }

  return [...orderedLists, ...Array.from(mapById.values())];
};

const getNotesListOrderStorageKey = (currentUserId: string, familyId: string) =>
  `notes-list-order:${currentUserId}:${familyId}`;

const parseFamily = (value: FamilyPayload): FamilyInfo | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

const visibilityLabel: Record<NoteListVisibility, string> = {
  family: "Famille",
  private: "Moi uniquement",
};

export default function NotesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [family, setFamily] = useState<FamilyInfo | null>(null);

  const [lists, setLists] = useState<NoteList[]>([]);
  const [items, setItems] = useState<NoteItem[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [newItemContent, setNewItemContent] = useState("");

  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const persistListOrder = (orderedLists: NoteList[], currentUserId: string, familyId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = getNotesListOrderStorageKey(currentUserId, familyId);
    window.localStorage.setItem(storageKey, JSON.stringify(orderedLists.map((list) => list.id)));
  };

  const loadLists = useCallback(async () => {
    setIsLoadingLists(true);
    setMessage(null);
    setErrorMessage(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Impossible de recuperer votre session utilisateur.");
      setIsLoadingLists(false);
      return;
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("family_members")
      .select("family_id, family:families(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1);

    if (membershipError) {
      setErrorMessage("Impossible de charger la famille active.");
      setIsLoadingLists(false);
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
      setLists([]);
      setSelectedListId(null);
      setItems([]);
      setErrorMessage("Aucune famille active. Creez ou rejoignez une famille.");
      setIsLoadingLists(false);
      return;
    }

    const { data, error } = await supabase
      .from("family_note_lists")
      .select("id, title, visibility, owner_user_id, created_at")
      .eq("family_id", activeFamily.id)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(
        "La table family_note_lists est introuvable ou inaccessible. Executez la migration supabase/migration_add_notes.sql dans Supabase SQL Editor.",
      );
      setIsLoadingLists(false);
      return;
    }

    const nextLists = ((data ?? []) as NoteListRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      visibility: row.visibility,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
    }));

    const storageKey = getNotesListOrderStorageKey(user.id, activeFamily.id);
    let storedOrderIds: string[] = [];

    if (typeof window !== "undefined") {
      const rawValue = window.localStorage.getItem(storageKey);
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue) as unknown;
          if (Array.isArray(parsed)) {
            storedOrderIds = parsed.filter((value): value is string => typeof value === "string");
          }
        } catch {
          storedOrderIds = [];
        }
      }
    }

    const orderedLists = sortListsByStoredOrder(nextLists, storedOrderIds);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(orderedLists.map((list) => list.id)));
    }

    setLists(orderedLists);
    setSelectedListId((previous) => {
      if (previous && orderedLists.some((list) => list.id === previous)) {
        return previous;
      }
      return orderedLists[0]?.id ?? null;
    });
    setIsLoadingLists(false);
  }, [supabase]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    const loadItems = async () => {
      if (!family || !selectedListId) {
        setItems([]);
        return;
      }

      setIsLoadingItems(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("family_note_items")
        .select("id, list_id, content, done, created_at")
        .eq("family_id", family.id)
        .eq("list_id", selectedListId)
        .order("done", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage("Impossible de charger les elements de cette liste.");
        setIsLoadingItems(false);
        return;
      }

      setItems(
        ((data ?? []) as NoteItemRow[]).map((row) => ({
          id: row.id,
          listId: row.list_id,
          content: row.content,
          done: row.done,
          createdAt: row.created_at,
        })),
      );
      setIsLoadingItems(false);
    };

    void loadItems();
  }, [family, selectedListId, supabase]);

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const doneCount = items.filter((item) => item.done).length;

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const cleanContent = newItemContent.trim();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!family || !selectedListId || !user || !cleanContent) {
      setErrorMessage("Le contenu de la note est obligatoire.");
      return;
    }

    setIsSavingItem(true);

    const { data, error } = await supabase
      .from("family_note_items")
      .insert({
        family_id: family.id,
        list_id: selectedListId,
        created_by: user.id,
        content: cleanContent,
        done: false,
      })
      .select("id, list_id, content, done, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Impossible d'ajouter cette note.");
      setIsSavingItem(false);
      return;
    }

    const newItem: NoteItem = {
      id: data.id,
      listId: data.list_id,
      content: data.content,
      done: data.done,
      createdAt: data.created_at,
    };

    setItems((previous) => [...previous, newItem]);
    setNewItemContent("");
    setIsSavingItem(false);
  };

  const handleToggleItem = async (itemId: string) => {
    setMessage(null);
    setErrorMessage(null);

    const currentItem = items.find((item) => item.id === itemId);
    if (!currentItem) {
      return;
    }

    const { error } = await supabase
      .from("family_note_items")
      .update({ done: !currentItem.done })
      .eq("id", currentItem.id)
      .eq("list_id", currentItem.listId);

    if (error) {
      setErrorMessage("Impossible de mettre a jour cet element.");
      return;
    }

    setItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              done: !item.done,
            }
          : item,
      ),
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("family_note_items").delete().eq("id", itemId);

    if (error) {
      setErrorMessage("Impossible de supprimer cet element.");
      return;
    }

    setItems((previous) => previous.filter((item) => item.id !== itemId));
  };

  const handleClearDone = async () => {
    if (!selectedListId) {
      return;
    }

    const doneIds = items.filter((item) => item.done).map((item) => item.id);
    if (doneIds.length === 0) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase
      .from("family_note_items")
      .delete()
      .eq("list_id", selectedListId)
      .in("id", doneIds);

    if (error) {
      setErrorMessage("Impossible de supprimer les elements coches.");
      return;
    }

    setItems((previous) => previous.filter((item) => !item.done));
  };

  const summaryText = `${family ? `Famille active: ${family.name}` : "Famille active: Aucune"} · Liste: ${selectedList?.title ?? "Aucune"} · ${doneCount}/${items.length} traite(s)`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-800">📝 Notes</h1>
          <p className="text-sm text-slate-500">{summaryText}</p>
          {message ? <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">{message}</p> : null}
          {errorMessage ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{errorMessage}</p> : null}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label htmlFor="notes-list-select" className="block text-sm font-medium text-slate-700">
                Choisir une liste
              </label>
              <select
                id="notes-list-select"
                value={selectedListId ?? ""}
                onChange={(event) => setSelectedListId(event.target.value || null)}
                disabled={lists.length === 0 || !family}
                className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {lists.length === 0 ? <option value="">Aucune liste</option> : null}
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title} · {visibilityLabel[list.visibility]}
                  </option>
                ))}
              </select>

              {selectedList ? (
                <p className="text-xs text-slate-500">
                  Visibilite: <span className="font-medium text-slate-700">{visibilityLabel[selectedList.visibility]}</span>
                </p>
              ) : null}
            </div>

            <div className="md:justify-self-end">
              <Link
                href="/protected/parametres/notes"
                className="inline-flex bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                Parametres des notes
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <form onSubmit={handleAddItem} className="grid sm:grid-cols-4 gap-3 mb-6">
            <input
              type="text"
              value={newItemContent}
              onChange={(event) => setNewItemContent(event.target.value)}
              placeholder="Ex: Penser a prendre les papiers"
              className="sm:col-span-3 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              disabled={!selectedListId || isSavingItem}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isSavingItem ? "Ajout..." : "Ajouter"}
            </button>
          </form>

          {isLoadingLists || isLoadingItems ? (
            <p className="text-slate-500">Chargement des notes...</p>
          ) : !selectedListId ? (
            <p className="text-slate-500">Creez une premiere liste de notes pour commencer.</p>
          ) : items.length === 0 ? (
            <p className="text-slate-500">Aucun element dans cette liste.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-3">
                    <label className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => void handleToggleItem(item.id)}
                        className="h-5 w-5 accent-rose-500"
                      />
                      <span className={`truncate ${item.done ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {item.content}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleDeleteItem(item.id)}
                      className="text-sm bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded transition-colors"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>

              <div className="pt-4 mt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleClearDone()}
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors"
                >
                  Retirer les elements coches
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
