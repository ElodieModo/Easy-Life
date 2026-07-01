"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";

type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  done: boolean;
  createdAt: string;
};

type ShoppingList = {
  id: string;
  name: string;
  createdAt: string;
};

const sortListsByStoredOrder = (lists: ShoppingList[], orderedIds: string[]) => {
  if (orderedIds.length === 0) {
    return lists;
  }

  const mapById = new Map(lists.map((list) => [list.id, list]));
  const orderedLists: ShoppingList[] = [];

  for (const id of orderedIds) {
    const list = mapById.get(id);
    if (list) {
      orderedLists.push(list);
      mapById.delete(id);
    }
  }

  return [...orderedLists, ...Array.from(mapById.values())];
};

const normalizeListName = (name: string) =>
  name.trim().toLowerCase() === "liste principale" ? "Notes diverses" : name;

type FamilyInfo = {
  id: string;
  name: string;
};

type FamilyPayload = FamilyInfo | FamilyInfo[] | null;

type ShoppingItemRow = {
  id: string;
  name: string;
  quantity: string;
  done: boolean;
  created_at: string;
};

type ShoppingListRow = {
  id: string;
  name: string;
  created_at: string;
};

type FamilyMembershipRow = {
  family_id?: string | null;
  family: FamilyPayload;
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

const getListOrderStorageKey = (currentUserId: string, familyId: string) =>
  `shopping-list-order:${currentUserId}:${familyId}`;

export default function ShoppingListPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [newListName, setNewListName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const persistListOrder = (orderedLists: ShoppingList[], currentUserId: string, familyId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = getListOrderStorageKey(currentUserId, familyId);
    window.localStorage.setItem(storageKey, JSON.stringify(orderedLists.map((list) => list.id)));
  };

  useEffect(() => {
    const loadInitialData = async () => {
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
        setErrorMessage(
          "Les tables famille ne sont pas disponibles. Exécutez le script SQL family_schema.sql dans Supabase.",
        );
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
        setErrorMessage("Aucune famille active. Créez ou rejoignez une famille dans Paramètres > Ma famille.");
        setItems([]);
        setLists([]);
        setSelectedListId(null);
        setIsLoading(false);
        return;
      }

      const { data: listsData, error: listsError } = await supabase
        .from("shopping_lists")
        .select("id, name, created_at")
        .eq("family_id", activeFamily.id)
        .order("created_at", { ascending: true });

      if (listsError) {
        setErrorMessage("La table shopping_lists est introuvable ou inaccessible.");
        setIsLoading(false);
        return;
      }

      let availableLists = ((listsData ?? []) as ShoppingListRow[]).map((row) => ({
        id: row.id,
        name: normalizeListName(row.name),
        createdAt: row.created_at,
      }));

      if (availableLists.length === 0) {
        const { data: defaultList, error: defaultListError } = await supabase
          .from("shopping_lists")
          .insert({
            family_id: activeFamily.id,
            created_by: user.id,
            name: "Notes diverses",
          })
          .select("id, name, created_at")
          .single();

        if (defaultListError || !defaultList) {
          setErrorMessage("Impossible de créer la liste.");
          setIsLoading(false);
          return;
        }

        availableLists = [
          {
            id: defaultList.id,
            name: normalizeListName(defaultList.name),
            createdAt: defaultList.created_at,
          },
        ];
      }

      const storageKey = getListOrderStorageKey(user.id, activeFamily.id);
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

      const orderedLists = sortListsByStoredOrder(availableLists, storedOrderIds);

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
      setIsLoading(false);
    };

    void loadInitialData();
  }, [supabase]);

  useEffect(() => {
    const loadItemsForList = async () => {
      if (!family || !selectedListId) {
        setItems([]);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, done, created_at")
        .eq("family_id", family.id)
        .eq("list_id", selectedListId)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage("La table shopping_items est introuvable ou inaccessible.");
        setIsLoading(false);
        return;
      }

      const rows = (data ?? []) as ShoppingItemRow[];
      setItems(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          quantity: row.quantity,
          done: row.done,
          createdAt: row.created_at,
        })),
      );
      setIsLoading(false);
    };

    void loadItemsForList();
  }, [family, selectedListId, supabase]);

  const completedCount = useMemo(() => items.filter((item) => item.done).length, [items]);

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanQuantity = quantity.trim();

    if (!cleanName || !userId || !family || !selectedListId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        family_id: family.id,
        list_id: selectedListId,
        created_by: userId,
        name: cleanName,
        quantity: cleanQuantity || "1",
        done: false,
      })
      .select("id, name, quantity, done, created_at")
      .single();

    if (error || !data) {
      setErrorMessage("Erreur lors de l'ajout de l'article.");
      setIsSaving(false);
      return;
    }

    const newItem: ShoppingItem = {
      id: data.id,
      name: data.name,
      quantity: data.quantity,
      done: data.done,
      createdAt: data.created_at,
    };

    setItems((previous) => [newItem, ...previous]);
    setName("");
    setQuantity("");
    setIsSaving(false);
  };

  const toggleItem = async (id: string) => {
    if (!userId || !family || !selectedListId) {
      return;
    }

    const currentItem = items.find((item) => item.id === id);
    if (!currentItem) {
      return;
    }

    setErrorMessage(null);
    const { error } = await supabase
      .from("shopping_items")
      .update({ done: !currentItem.done })
      .eq("id", id)
      .eq("list_id", selectedListId)
      .eq("family_id", family.id);

    if (error) {
      setErrorMessage("Erreur lors de la mise à jour de l'article.");
      return;
    }

    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              done: !item.done,
            }
          : item,
      ),
    );
  };

  const deleteItem = async (id: string) => {
    if (!userId || !family || !selectedListId) {
      return;
    }

    setErrorMessage(null);
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", id)
      .eq("list_id", selectedListId)
      .eq("family_id", family.id);

    if (error) {
      setErrorMessage("Erreur lors de la suppression de l'article.");
      return;
    }

    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  const clearCompleted = async () => {
    if (!userId || !family || !selectedListId) {
      return;
    }

    const completedIds = items.filter((item) => item.done).map((item) => item.id);
    if (completedIds.length === 0) {
      return;
    }

    setErrorMessage(null);
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("family_id", family.id)
      .eq("list_id", selectedListId)
      .in("id", completedIds);

    if (error) {
      setErrorMessage("Erreur lors du nettoyage des articles cochés.");
      return;
    }

    setItems((previous) => previous.filter((item) => !item.done));
  };

  const handleCreateList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanName = newListName.trim();
    if (!cleanName || !userId || !family) {
      return;
    }

    setIsCreatingList(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({
        family_id: family.id,
        created_by: userId,
        name: cleanName,
      })
      .select("id, name, created_at")
      .single();

    if (error || !data) {
      setErrorMessage("Impossible de créer la nouvelle liste (nom peut-être déjà utilisé).");
      setIsCreatingList(false);
      return;
    }

    const createdList: ShoppingList = {
      id: data.id,
      name: normalizeListName(data.name),
      createdAt: data.created_at,
    };

    setLists((previous) => {
      const nextLists = [...previous, createdList];
      if (userId && family) {
        persistListOrder(nextLists, userId, family.id);
      }
      return nextLists;
    });
    setSelectedListId(createdList.id);
    setNewListName("");
    setIsCreatingList(false);
  };

  const handleMoveSelectedList = (direction: "up" | "down") => {
    if (!selectedListId || !userId || !family) {
      return;
    }

    setLists((previous) => {
      const currentIndex = previous.findIndex((list) => list.id === selectedListId);
      if (currentIndex < 0) {
        return previous;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }

      const nextLists = [...previous];
      const [movedList] = nextLists.splice(currentIndex, 1);
      nextLists.splice(targetIndex, 0, movedList);
      persistListOrder(nextLists, userId, family.id);
      return nextLists;
    });
  };

  const selectedListIndex = selectedListId ? lists.findIndex((list) => list.id === selectedListId) : -1;
  const canMoveUp = selectedListIndex > 0;
  const canMoveDown = selectedListIndex >= 0 && selectedListIndex < lists.length - 1;

  const selectedListName = lists.find((list) => list.id === selectedListId)?.name ?? "Aucune";

  const summaryText = `${family ? `Famille active: ${family.name}` : "Famille active: Aucune"} · Liste active: ${selectedListName} · ${completedCount} / ${items.length} article${items.length > 1 ? "s" : ""} acheté${completedCount > 1 ? "s" : ""}`;

  const handleSaveCurrentOrder = () => {
    if (!userId || !family) {
      return;
    }
    persistListOrder(lists, userId, family.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="mb-8 space-y-3">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-800">🛒 Liste de courses</h1>
          <p className="text-sm text-slate-500">{summaryText}</p>
          {errorMessage ? (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{errorMessage}</p>
          ) : null}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 mb-8">
          <div className="grid sm:grid-cols-5 gap-3 items-end">
            <div className="sm:col-span-2 space-y-2">
              <label htmlFor="shopping-list-select" className="block text-sm font-medium text-slate-700 mb-1">
                Choisir une liste
              </label>
              <select
                id="shopping-list-select"
                value={selectedListId ?? ""}
                onChange={(event) => setSelectedListId(event.target.value || null)}
                className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                disabled={!family || lists.length === 0}
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleMoveSelectedList("up")}
                  disabled={!canMoveUp}
                  aria-label="Monter la liste"
                  title="Monter"
                  className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-500 text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveSelectedList("down")}
                  disabled={!canMoveDown}
                  aria-label="Descendre la liste"
                  title="Descendre"
                  className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-500 text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentOrder}
                  disabled={!userId || !family || lists.length === 0}
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
                >
                  Enregistrer l'ordre
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateList} className="sm:col-span-3 grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="Nouvelle liste (ex: Weekend)"
                className="sm:col-span-2 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="submit"
                disabled={!userId || !family || isCreatingList}
                className="bg-stone-700 hover:bg-stone-800 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                {isCreatingList ? "Creation..." : "Creer une liste"}
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 mb-8">
          <form onSubmit={handleAddItem} className="grid sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Pommes"
              className="sm:col-span-2 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <input
              type="text"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Quantité (ex: 2 kg)"
              className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              disabled={isSaving || !userId || !family || !selectedListId}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              {isSaving ? "Ajout..." : "Ajouter"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          {isLoading ? (
            <div className="text-center py-10 text-slate-500">Chargement de la liste...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              Votre liste est vide. Ajoutez votre premier article 👆
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleItem(item.id)}
                        className="h-5 w-5 accent-rose-500"
                      />
                      <div className="min-w-0">
                        <p
                          className={`font-medium text-slate-800 truncate ${
                            item.done ? "line-through text-slate-400" : ""
                          }`}
                        >
                          {item.name}
                        </p>
                        <p className="text-sm text-slate-500">Quantité: {item.quantity}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
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
                  onClick={clearCompleted}
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors"
                >
                  Retirer les articles cochés
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}