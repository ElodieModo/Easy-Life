"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";

type Family = {
	id: string;
	name: string;
};

type FamilyPayload = Family | Family[] | null;

type FamilyMembershipRow = {
	family_id?: string | null;
	role?: string | null;
	family?: FamilyPayload;
};

type FamilyMember = {
	id: string;
	user_id: string;
	role: string;
	joined_at: string;
	display_name: string;
	email: string;
};

type PendingInvite = {
	id: string;
	email: string;
	created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
	owner: "Propriétaire",
	admin: "Admin",
	member: "Membre",
};

const ROLE_COLORS: Record<string, string> = {
	owner: "bg-amber-100 text-amber-800 border-amber-200",
	admin: "bg-blue-100 text-blue-800 border-blue-200",
	member: "bg-slate-100 text-slate-600 border-slate-200",
};

const parseFamily = (value: FamilyPayload): Family | null => {
	if (!value) return null;
	if (Array.isArray(value)) return value[0] ?? null;
	return value;
};

export default function FamilySettingsPage() {
	const supabase = useMemo(() => createClient(), []);
	const [family, setFamily] = useState<Family | null>(null);
	const [members, setMembers] = useState<FamilyMember[]>([]);
	const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
	const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [familyName, setFamilyName] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [lastInvitedEmail, setLastInvitedEmail] = useState("");
	const [inviteTokenInput, setInviteTokenInput] = useState("");
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isRevokingId, setIsRevokingId] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [inviteMessage, setInviteMessage] = useState<string | null>(null);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [displayNameInput, setDisplayNameInput] = useState("");
	const [isSavingName, setIsSavingName] = useState(false);

	const loadFamily = useCallback(async () => {
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

		setCurrentUserId(user.id);
		const name = (user.user_metadata?.display_name as string) ?? "";
		setDisplayName(name);
		setDisplayNameInput(name);

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
		const role = membership?.role ?? null;
		setCurrentUserRole(role);

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
				linkedFamily = { id: familyRow.id, name: familyRow.name };
			}
		}

		setFamily(linkedFamily);

		if (linkedFamily) {
			const { data: membersData } = await supabase.rpc("get_family_members");
			setMembers((membersData as FamilyMember[]) ?? []);

			if (role === "owner" || role === "admin") {
				const { data: invitesData } = await supabase.rpc("get_family_pending_invites");
				setPendingInvites((invitesData as PendingInvite[]) ?? []);
			}
		}

		setIsLoading(false);
	}, [supabase]);

	useEffect(() => {
		void loadFamily();
	}, [loadFamily]);

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
		setMessage("Famille créée avec succès !");
		await loadFamily();
		setIsSubmitting(false);
	};

	const handleCreateInvite = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const cleanEmail = inviteEmail.trim().toLowerCase();
		if (!cleanEmail) {
			setInviteError("Veuillez saisir l'email de la personne à inviter.");
			return;
		}
		setIsSubmitting(true);
		setInviteMessage(null);
		setInviteError(null);
		setInviteLink(null);
		const { data, error } = await supabase.rpc("create_family_invite", { target_email: cleanEmail });
		if (error) {
			setInviteError(error.message);
			setIsSubmitting(false);
			return;
		}
		const token = (data as string) ?? null;
		if (token && typeof window !== "undefined") {
			setInviteLink(`${window.location.origin}/auth/invitation?token=${token}`);
		}
		setLastInvitedEmail(cleanEmail);
		setInviteEmail("");
		setInviteMessage("Invitation créée ! Partagez le lien ci-dessous.");
		await loadFamily();
		setIsSubmitting(false);
	};

	const copyInviteLink = async () => {
		if (!inviteLink) return;
		try {
			await navigator.clipboard.writeText(inviteLink);
			setInviteMessage("Lien copié dans le presse-papiers !");
		} catch {
			setInviteError("Impossible de copier automatiquement. Copiez le lien manuellement.");
		}
	};

	const handleRevokeInvite = async (inviteId: string, email: string) => {
		setIsRevokingId(inviteId);
		setInviteError(null);
		setInviteMessage(null);
		const { error } = await supabase.rpc("revoke_family_invite", { invite_id: inviteId });
		if (error) {
			setInviteError(`Impossible de révoquer : ${error.message}`);
		} else {
			setInviteMessage(`Invitation de ${email} révoquée.`);
			setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
		}
		setIsRevokingId(null);
	};

	const handleSaveDisplayName = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const clean = displayNameInput.trim();
		if (!clean) {
			setErrorMessage("Le nom d'affichage ne peut pas être vide.");
			return;
		}
		setIsSavingName(true);
		setMessage(null);
		setErrorMessage(null);
		const { error } = await supabase.auth.updateUser({ data: { display_name: clean } });
		if (error) {
			setErrorMessage(error.message);
		} else {
			setDisplayName(clean);
			setMessage(`Nom d'affichage mis à jour : « ${clean} ».`);
		}
		setIsSavingName(false);
	};

	const handleAcceptInvite = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		let raw = inviteTokenInput.trim();
		try {
			const url = new URL(raw);
			const tokenParam = url.searchParams.get("token");
			if (tokenParam) raw = tokenParam;
		} catch {
			// pas une URL, on utilise tel quel
		}
		if (!raw) {
			setErrorMessage("Veuillez coller un lien ou code d'invitation.");
			return;
		}
		setIsSubmitting(true);
		setMessage(null);
		setErrorMessage(null);
		const { error } = await supabase.rpc("accept_family_invite", { invite_token: raw });
		if (error) {
			setErrorMessage(error.message);
			setIsSubmitting(false);
			return;
		}
		setInviteTokenInput("");
		setMessage("Invitation acceptée ! Vous avez rejoint la famille.");
		await loadFamily();
		setIsSubmitting(false);
	};

	const canInvite = currentUserRole === "owner" || currentUserRole === "admin";

	return (
		<div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100">
			<Navbar />

			<div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-6 sm:space-y-8">
				{/* Nom d'affichage */}
				<div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
					<h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">Ma famille</h1>
					<p className="text-slate-500 text-sm mb-6">Gérez votre famille, les membres et les invitations.</p>

					<div className="border-t border-slate-100 pt-6">
						<h2 className="text-base font-semibold text-slate-700 mb-1">Mon nom affiché</h2>
						<p className="text-sm text-slate-500 mb-3">
							Visible sur l&apos;accueil à la place de votre email.
							{displayName ? <span className="ml-1 font-medium text-slate-700">Actuel : « {displayName} »</span> : null}
						</p>
						<form onSubmit={handleSaveDisplayName} className="flex gap-3 items-center">
							<input
								type="text"
								value={displayNameInput}
								onChange={(e) => setDisplayNameInput(e.target.value)}
								placeholder="Ex : Elodie"
								maxLength={50}
								className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-sm"
							/>
							<button
								type="submit"
								disabled={isSavingName}
								className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 text-sm whitespace-nowrap"
							>
								{isSavingName ? "Sauvegarde…" : "Enregistrer"}
							</button>
						</form>
					</div>

					{message ? <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{message}</p> : null}
					{errorMessage ? <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p> : null}
				</div>

				{/* Famille */}
				{isLoading ? (
					<div className="bg-white rounded-xl shadow-md p-6">
						<p className="text-slate-400 animate-pulse">Chargement…</p>
					</div>
				) : family ? (
					<>
						{/* Membres */}
						<div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
							<div className="flex items-center gap-3 mb-4">
								<span className="text-3xl">🏠</span>
								<div>
									<h2 className="text-xl font-bold text-slate-800">{family.name}</h2>
									<p className="text-sm text-slate-500">{members.length} membre{members.length > 1 ? "s" : ""}</p>
								</div>
							</div>
							<div className="space-y-2">
								{members.map((m) => (
									<div
										key={m.id}
										className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
											m.user_id === currentUserId
												? "bg-rose-50 border-rose-200"
												: "bg-slate-50 border-slate-200"
										}`}
									>
										<div>
											<p className="text-sm font-medium text-slate-800">
												{m.display_name || m.email}
												{m.user_id === currentUserId ? <span className="ml-2 text-xs text-rose-500">(vous)</span> : null}
											</p>
											{m.display_name ? <p className="text-xs text-slate-400">{m.email}</p> : null}
										</div>
										<span className={`text-xs font-medium px-2 py-1 rounded-full border ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>
											{ROLE_LABELS[m.role] ?? m.role}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Inviter (owner/admin seulement) */}
						{canInvite ? (
							<div className="bg-white rounded-xl shadow-md p-6 sm:p-8">
								<h3 className="text-lg font-bold text-slate-800 mb-1">Inviter un membre</h3>
								<p className="text-sm text-slate-500 mb-4">Un lien d&apos;invitation sera généré et pourra être partagé.</p>

								<form onSubmit={handleCreateInvite} className="flex gap-3 flex-col sm:flex-row">
									<input
										type="email"
										value={inviteEmail}
										onChange={(e) => setInviteEmail(e.target.value)}
										placeholder="email@exemple.com"
										className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-sm"
									/>
									<button
										type="submit"
										disabled={isSubmitting}
										className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 text-sm whitespace-nowrap"
									>
										{isSubmitting ? "Génération…" : "Créer l'invitation"}
									</button>
								</form>

								{inviteMessage ? <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{inviteMessage}</p> : null}
								{inviteError ? <p className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{inviteError}</p> : null}

								{inviteLink ? (
									<div className="mt-4 border border-rose-200 bg-rose-50 rounded-xl p-4">
										<p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
											Lien pour {lastInvitedEmail}
										</p>
										<p className="text-xs break-all text-slate-700 bg-white rounded-lg border border-rose-100 px-3 py-2 font-mono mb-3 select-all">
											{inviteLink}
										</p>
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												onClick={copyInviteLink}
												className="text-sm bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
											>
												📋 Copier
											</button>
											<a
												href={`https://wa.me/?text=${encodeURIComponent(`Rejoins notre famille sur Easy-Life : ${inviteLink}`)}`}
												target="_blank"
												rel="noreferrer"
												className="text-sm bg-[#25D366] hover:bg-[#1fbd5b] text-white px-4 py-2 rounded-lg transition-colors font-medium"
											>
												💬 WhatsApp
											</a>
											<a
												href={`mailto:${lastInvitedEmail}?subject=Invitation%20Easy-Life&body=${encodeURIComponent(`Bonjour,\n\nRejoins notre famille sur Easy-Life avec ce lien :\n${inviteLink}`)}`}
												className="text-sm bg-white hover:bg-rose-100 text-rose-800 px-4 py-2 rounded-lg border border-rose-300 transition-colors font-medium"
											>
												✉️ Email
											</a>
										</div>
									</div>
								) : null}

								{/* Invitations en attente */}
								{pendingInvites.length > 0 ? (
									<div className="mt-6">
										<h4 className="text-sm font-semibold text-slate-700 mb-2">Invitations en attente</h4>
										<div className="space-y-2">
											{pendingInvites.map((invite) => (
												<div key={invite.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
													<div>
														<p className="text-sm text-slate-700 font-medium">{invite.email}</p>
														<p className="text-xs text-slate-400">Envoyée le {new Date(invite.created_at).toLocaleDateString("fr-FR")}</p>
													</div>
													<button
														type="button"
														onClick={() => handleRevokeInvite(invite.id, invite.email)}
														disabled={isRevokingId === invite.id}
														className="text-xs text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-400 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
													>
														{isRevokingId === invite.id ? "Révocation…" : "Révoquer"}
													</button>
												</div>
											))}
										</div>
									</div>
								) : null}
							</div>
						) : null}
					</>
				) : (
					<div className="grid md:grid-cols-2 gap-6">
						<div className="bg-white rounded-xl shadow-md p-6">
							<h3 className="text-xl font-bold text-slate-800 mb-1">Créer une famille</h3>
							<p className="text-sm text-slate-500 mb-4">Vous serez propriétaire et pourrez inviter des membres.</p>
							<form onSubmit={handleCreateFamily} className="space-y-3">
								<input
									type="text"
									value={familyName}
									onChange={(e) => setFamilyName(e.target.value)}
									placeholder="Ex : Famille Dupont"
									className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
								/>
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60"
								>
									{isSubmitting ? "Création…" : "Créer ma famille"}
								</button>
							</form>
						</div>

						<div className="bg-white rounded-xl shadow-md p-6">
							<h3 className="text-xl font-bold text-slate-800 mb-1">Rejoindre une famille</h3>
							<p className="text-sm text-slate-500 mb-4">Collez le lien d&apos;invitation reçu.</p>
							<form onSubmit={handleAcceptInvite} className="space-y-3">
								<input
									type="text"
									value={inviteTokenInput}
									onChange={(e) => setInviteTokenInput(e.target.value)}
									placeholder="https://… ou code d'invitation"
									className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400"
								/>
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full bg-stone-700 hover:bg-stone-800 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60"
								>
									{isSubmitting ? "Validation…" : "Rejoindre la famille"}
								</button>
							</form>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

