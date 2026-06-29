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

type UsefulAddressRow = {
  id: string;
  category: "maison" | "ecole" | "travail" | "autre";
  label: string;
  address: string;
  notes: string | null;
  created_at: string;
};

type UsefulAddress = {
  id: string;
  category: "maison" | "ecole" | "travail" | "autre";
  label: string;
  address: string;
  notes: string | null;
  createdAt: string;
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

const categoryLabel: Record<UsefulAddress["category"], string> = {
  maison: "Maison",
  ecole: "Ecole",
  travail: "Travail",
  autre: "Autre",
};

export default function UsefulAddressesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [addresses, setAddresses] = useState<UsefulAddress[]>([]);
  const [category, setCategory] = useState<UsefulAddress["category"]>("maison");
  const [label, setLabel] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [notes, setNotes] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAddresses = async () => {
    setIsLoading(true);
    setMessage(null);
    setErrorMessage(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("Impossible de recuperer votre session utilisateur.");
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
      setAddresses([]);
      setErrorMessage("Aucune famille active. Creez ou rejoignez une famille.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("family_useful_addresses")
      .select("id, category, label, address, notes, created_at")
      .eq("family_id", activeFamily.id)
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(
        "La table family_useful_addresses est introuvable ou inaccessible. Exécutez la migration supabase/migration_add_family_addresses.sql dans Supabase SQL Editor.",
      );
      setIsLoading(false);
      return;
    }

    setAddresses(
      ((data ?? []) as UsefulAddressRow[]).map((row) => ({
        id: row.id,
        category: row.category,
        label: row.label,
        address: row.address,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    );

    setIsLoading(false);
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const handleAddAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    const cleanLabel = label.trim();
    const cleanAddress = addressValue.trim();

    if (!family || !userId || !cleanLabel || !cleanAddress) {
      setErrorMessage("Le nom et l'adresse sont obligatoires.");
      return;
    }

    setIsSaving(true);

    const { data, error } = await supabase
      .from("family_useful_addresses")
      .insert({
        family_id: family.id,
        category,
        label: cleanLabel,
        address: cleanAddress,
        notes: notes.trim() || null,
        created_by: userId,
      })
      .select("id, category, label, address, notes, created_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Impossible d'ajouter cette adresse.");
      setIsSaving(false);
      return;
    }

    const newAddress: UsefulAddress = {
      id: data.id,
      category: data.category,
      label: data.label,
      address: data.address,
      notes: data.notes,
      createdAt: data.created_at,
    };

    setAddresses((previous) => [newAddress, ...previous]);
    setLabel("");
    setAddressValue("");
    setNotes("");
    setCategory("maison");
    setMessage("Adresse ajoutee et partagee avec la famille.");
    setIsSaving(false);
  };

  const handleDeleteAddress = async (id: string) => {
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("family_useful_addresses").delete().eq("id", id);

    if (error) {
      setErrorMessage("Impossible de supprimer cette adresse.");
      return;
    }

    setAddresses((previous) => previous.filter((entry) => entry.id !== id));
    setMessage("Adresse supprimee.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">Adresses utiles</h1>
            <Link
              href="/protected/parametres"
              className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded font-medium transition-colors"
            >
              Paramètres
            </Link>
          </div>
          <p className="text-slate-600">
            Base d'adresses partagee au niveau famille (maison, ecole, travail) avec un espace notes pour chaque
            entree.
          </p>
          <p className="text-sm text-slate-500 mt-2">Famille active: {family ? family.name : "Aucune"}</p>
          {message ? (
            <p className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{message}</p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{errorMessage}</p>
          ) : null}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Ajouter une adresse</h2>
          <form onSubmit={handleAddAddress} className="grid md:grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as UsefulAddress["category"])}
              className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="maison">Maison</option>
              <option value="ecole">Ecole</option>
              <option value="travail">Travail</option>
              <option value="autre">Autre</option>
            </select>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Nom (ex: Ecole Jean Moulin)"
              className="px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <input
              type="text"
              value={addressValue}
              onChange={(event) => setAddressValue(event.target.value)}
              placeholder="Adresse complete"
              className="md:col-span-2 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes (digicode, horaires, personne a contacter, etc.)"
              rows={3}
              className="md:col-span-2 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              disabled={isSaving || !family}
              className="md:col-span-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? "Ajout..." : "Ajouter cette adresse"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Base d'adresses de la famille</h2>
          {isLoading ? (
            <p className="text-slate-500">Chargement des adresses...</p>
          ) : addresses.length === 0 ? (
            <p className="text-slate-500">Aucune adresse pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((entry) => (
                <li key={entry.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-rose-700">{categoryLabel[entry.category]}</p>
                      <p className="text-lg font-semibold text-slate-800">{entry.label}</p>
                      <p className="text-slate-700">{entry.address}</p>
                      {entry.notes ? <p className="text-sm text-slate-600 mt-2">Notes: {entry.notes}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAddress(entry.id)}
                      className="text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 px-2 py-1 rounded"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
