"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";

type Family = {
  id: string;
  name: string;
};

type FamilyPayload = Family | Family[] | null;

type FamilyMembershipRow = {
  family_id?: string | null;
  family?: FamilyPayload;
};

const parseFamily = (value: FamilyPayload): Family | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

export default function FamilyPage() {
  const supabase = useMemo(() => createClient(), []);
  const [family, setFamily] = useState<Family | null>(null);
  const [membersCount, setMembersCount] = useState(0);
  const [familyName, setFamilyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [lastInvitedEmail, setLastInvitedEmail] = useState("");
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFamily = async () => {
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

    const { data: membershipRows, error: membershipError } = await supabase
      .from("family_members")
      .select("id, role, joined_at, family_id, family:families(id, name)")
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
    let linkedFamily = parseFamily(membership?.family ?? null);
    let linkedFamilyId = linkedFamily?.id ?? membership?.family_id ?? null;

    if (!linkedFamilyId) {
      const { data: fallbackFamilyId, error: fallbackError } = await supabase.rpc("user_family_id");
      if (!fallbackError && fallbackFamilyId) {
        linkedFamilyId = fallbackFamilyId as string;
      }
    }

    if (!linkedFamily && linkedFamilyId) {
      const { data: familyRow, error: familyError } = await supabase
        .from("families")
        .select("id, name")
        .eq("id", linkedFamilyId)
        .single();

      if (!familyError && familyRow) {
        linkedFamily = {
          id: familyRow.id,
          name: familyRow.name,
        };
      }
    }

    setFamily(linkedFamily);

    if (linkedFamily) {
      const { count } = await supabase
        .from("family_members")
        .select("id", { count: "exact", head: true })
        .eq("family_id", linkedFamily.id);
      setMembersCount(count ?? 0);
    } else {
      setMembersCount(0);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadFamily();
  }, []);

  const handleCreateFamily = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = familyName.trim();

    if (!cleanName) {
      setErrorMessage("Veuillez renseigner un nom de famille.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.rpc("create_family", { p_name: cleanName });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setFamilyName("");
    setMessage("Famille créée avec succès.");
    await loadFamily();
    setIsSubmitting(false);
  };

  const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Veuillez saisir l'email de la personne à inviter.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    const { data, error } = await supabase.rpc("create_family_invite", { target_email: cleanEmail });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    const token = (data as string) ?? null;
    setCreatedToken(token);

    if (token && typeof window !== "undefined") {
      setInviteLink(`${window.location.origin}/auth/invitation?token=${token}`);
    } else {
      setInviteLink(null);
    }

    setLastInvitedEmail(cleanEmail);
    setInviteEmail("");
    setMessage("Invitation créée. Partagez le lien ci-dessous avec ce membre.");
    setIsSubmitting(false);
  };

  const copyInviteLink = async () => {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("Lien d'invitation copié dans le presse-papiers.");
    } catch {
      setErrorMessage("Impossible de copier automatiquement. Vous pouvez copier le lien manuellement.");
    }
  };

  const handleAcceptInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = inviteTokenInput.trim();

    if (!token) {
      setErrorMessage("Veuillez coller un lien d'invitation.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.rpc("accept_family_invite", { invite_token: token });

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setInviteTokenInput("");
    setMessage("Invitation acceptée. Vous avez rejoint la famille.");
    await loadFamily();
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">👨‍👩‍👧‍👦 Ma famille</h1>
          <p className="text-slate-600">
            Créez un compte famille, invitez vos proches et partagez les fonctionnalités de l'app.
          </p>
          {message ? (
            <p className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">
              {message}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          {isLoading ? (
            <p className="text-slate-500">Chargement des informations famille...</p>
          ) : family ? (
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800">Famille active: {family.name}</h2>
              <p className="text-slate-600">Membres: {membersCount}</p>
            </div>
          ) : (
            <p className="text-slate-600">Aucune famille liée à votre compte pour le moment.</p>
          )}
        </div>

        {!family ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-3">Créer une famille</h3>
              <form onSubmit={handleCreateFamily} className="space-y-3">
                <input
                  type="text"
                  value={familyName}
                  onChange={(event) => setFamilyName(event.target.value)}
                  placeholder="Ex: Famille Dupont"
                  className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Création..." : "Créer ma famille"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-3">Rejoindre avec un lien d'invitation</h3>
              <form onSubmit={handleAcceptInvite} className="space-y-3">
                <input
                  type="text"
                  value={inviteTokenInput}
                  onChange={(event) => setInviteTokenInput(event.target.value)}
                  placeholder="Collez le lien d'invitation"
                  className="w-full px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-stone-700 hover:bg-stone-800 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Validation..." : "Rejoindre une famille"}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-3">Inviter un membre</h3>
            <form onSubmit={handleCreateInvite} className="grid sm:grid-cols-3 gap-3 items-center">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="email@exemple.com"
                className="sm:col-span-2 px-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-60"
              >
                {isSubmitting ? "Création..." : "Créer l'invitation"}
              </button>
            </form>

            {createdToken ? (
              <div className="mt-4 border border-rose-200 bg-rose-50 rounded p-4">
                <p className="text-sm text-rose-800 font-medium">Code d'invitation :</p>
                <p className="text-sm break-all text-rose-900 mt-1">{createdToken}</p>
                {inviteLink ? (
                  <>
                    <p className="text-sm text-rose-800 font-medium mt-3">Lien d'invitation :</p>
                    <a
                      href={inviteLink}
                      className="text-sm break-all text-rose-900 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {inviteLink}
                    </a>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={copyInviteLink}
                        className="text-sm bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        Copier le lien
                      </button>
                      <a
                        href={`mailto:${lastInvitedEmail}?subject=Invitation%20Easy-Life&body=Bonjour,%0A%0ARejoins%20notre%20famille%20sur%20Easy-Life%20avec%20ce%20lien%20:%0A${encodeURIComponent(inviteLink)}`}
                        className="text-sm bg-white hover:bg-rose-100 text-rose-800 px-3 py-1.5 rounded border border-rose-300 transition-colors"
                      >
                        Envoyer par email
                      </a>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}