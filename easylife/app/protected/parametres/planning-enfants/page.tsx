"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";

type FamilyInfo = {
  id: string;
  name: string;
};

type FamilyPayload = FamilyInfo | FamilyInfo[] | null;

type FamilyMembershipRow = {
  family_id?: string | null;
  family: FamilyPayload;
};

type ChildRow = {
  id: string;
  name: string;
  birth_date: string | null;
  color: string;
};

type Child = {
  id: string;
  name: string;
  birthDate: string | null;
  color: string;
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

export default function PlanningChildrenSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [childName, setChildName] = useState("");
  const [childBirthDate, setChildBirthDate] = useState("");
  const [childColor, setChildColor] = useState("#38bdf8");
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEditingChildId(null);
    setChildName("");
    setChildBirthDate("");
    setChildColor("#38bdf8");
  };

  const loadChildren = useCallback(async () => {
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
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  const handleSubmitChild = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const cleanName = childName.trim();
    if (!cleanName || !family || !userId) {
      return;
    }

    if (!editingChildId && children.length >= 3) {
      setErrorMessage("Maximum 3 enfants par famille.");
      return;
    }

    setIsSaving(true);

    if (editingChildId) {
      const { data, error } = await supabase
        .from("family_children")
        .update({
          name: cleanName,
          birth_date: childBirthDate || null,
          color: childColor,
        })
        .eq("id", editingChildId)
        .eq("family_id", family.id)
        .select("id, name, birth_date, color")
        .single();

      if (error || !data) {
        setErrorMessage(error?.message ?? "Impossible de modifier cet enfant.");
        setIsSaving(false);
        return;
      }

      const updatedChild: Child = {
        id: data.id,
        name: data.name,
        birthDate: data.birth_date,
        color: data.color,
      };

      setChildren((previous) => previous.map((child) => (child.id === updatedChild.id ? updatedChild : child)));
      setMessage("Enfant modifié avec succès.");
      resetForm();
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("family_children")
      .insert({
        family_id: family.id,
        name: cleanName,
        birth_date: childBirthDate || null,
        color: childColor,
        created_by: userId,
      })
      .select("id, name, birth_date, color")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Impossible d'ajouter l'enfant.");
      setIsSaving(false);
      return;
    }

    const newChild: Child = {
      id: data.id,
      name: data.name,
      birthDate: data.birth_date,
      color: data.color,
    };

    setChildren((previous) => [...previous, newChild]);
    resetForm();
    setMessage("Enfant ajouté avec succès.");
    setIsSaving(false);
  };

  const handleStartEditChild = (child: Child) => {
    setEditingChildId(child.id);
    setChildName(child.name);
    setChildBirthDate(child.birthDate ?? "");
    setChildColor(child.color);
    setMessage(null);
    setErrorMessage(null);
  };

  const handleDeleteChild = async (childId: string) => {
    if (!family) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("family_children").delete().eq("id", childId).eq("family_id", family.id);

    if (error) {
      setErrorMessage("Impossible de supprimer cet enfant.");
      return;
    }

    setChildren((previous) => previous.filter((child) => child.id !== childId));
    if (editingChildId === childId) {
      resetForm();
    }
    setMessage("Enfant supprimé du planning.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-800">Paramètres du planning enfants</h1>
            <Link
              href="/protected/planning-enfants"
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Retour au planning
            </Link>
          </div>
          <p className="text-slate-600">Ajoutez, modifiez ou supprimez les enfants ici uniquement.</p>
          <p className="text-sm text-slate-500 mt-2">Famille active: {family ? family.name : "Aucune"}</p>
          {message ? (
            <p className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{message}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{errorMessage}</p>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              {editingChildId ? "Modifier un enfant" : "Ajouter un enfant"}
            </h2>
            <form onSubmit={handleSubmitChild} className="space-y-2.5">
              <input
                type="text"
                value={childName}
                onChange={(inputEvent) => setChildName(inputEvent.target.value)}
                placeholder="Prénom"
                className="w-full px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={childBirthDate}
                  onChange={(inputEvent) => setChildBirthDate(inputEvent.target.value)}
                  className="px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <input
                  type="color"
                  value={childColor}
                  onChange={(inputEvent) => setChildColor(inputEvent.target.value)}
                  className="h-9 rounded border border-slate-300"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving || !family || (!editingChildId && children.length >= 3)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
              >
                {isSaving
                  ? editingChildId
                    ? "Enregistrement..."
                    : "Ajout..."
                  : editingChildId
                    ? "Enregistrer"
                    : children.length >= 3
                      ? "Limite atteinte"
                      : "Ajouter l'enfant"}
              </button>
              {editingChildId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded font-medium transition-colors"
                >
                  Annuler la modification
                </button>
              ) : null}
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 sm:p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Enfants de la famille</h3>
            {isLoading ? (
              <p className="text-sm text-slate-500">Chargement des enfants...</p>
            ) : children.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun enfant enregistré.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 border border-slate-200 rounded-md px-2.5 py-2 bg-slate-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: child.color }} />
                      <span className="text-sm text-slate-800 font-medium truncate max-w-24">{child.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEditChild(child)}
                        aria-label={`Modifier ${child.name}`}
                        title={`Modifier ${child.name}`}
                        className="inline-flex items-center justify-center h-7 w-7 bg-sky-100 text-sky-700 hover:bg-sky-200 rounded transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteChild(child.id)}
                        aria-label={`Supprimer ${child.name}`}
                        title={`Supprimer ${child.name}`}
                        className="inline-flex items-center justify-center h-7 w-7 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
