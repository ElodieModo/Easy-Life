"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function InvitationContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    const applyInvite = async () => {
      setIsLoading(true);
      setMessage(null);
      setErrorMessage(null);

      if (!token) {
        setErrorMessage("Lien d'invitation invalide (paramètre manquant).");
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNeedsAuth(true);
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.rpc("accept_family_invite", { invite_token: token });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setMessage("Invitation acceptée ! Redirection…");
      setIsLoading(false);
      router.push("/protected/parametres/ma-famille");
      router.refresh();
    };

    void applyInvite();
  }, [router, supabase, token]);

  const handleSendMagicLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = magicEmail.trim().toLowerCase();
    if (!email) return;

    setIsSendingLink(true);
    setErrorMessage(null);

    const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(`/auth/invitation?token=${token}`)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMagicLinkSent(true);
    }
    setIsSendingLink(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🏠</span>
          <h1 className="text-2xl font-bold text-slate-800">Invitation famille</h1>
        </div>

        {isLoading ? (
          <p className="text-slate-400 animate-pulse">Vérification de l&apos;invitation…</p>
        ) : null}

        {message ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{message}</p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</p>
        ) : null}

        {!isLoading && needsAuth ? (
          <>
            <p className="text-slate-600 text-sm mb-5">
              Entrez votre email pour recevoir un lien de connexion et rejoindre la famille directement.
            </p>

            {magicLinkSent ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">📬</p>
                <p className="font-semibold text-slate-800 mb-1">Vérifiez votre boîte mail</p>
                <p className="text-sm text-slate-500">
                  Un lien vous a été envoyé à <span className="font-medium">{magicEmail}</span>.<br />
                  Cliquez dessus pour rejoindre la famille automatiquement.
                </p>
                <p className="text-xs text-slate-400 mt-2">Pensez à vérifier vos spams.</p>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="flex flex-col gap-3">
                <input
                  type="email"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  disabled={isSendingLink}
                  className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-sm disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={isSendingLink}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {isSendingLink ? "Envoi en cours…" : "Recevoir un lien de connexion"}
                </button>
                <p className="text-xs text-slate-400 text-center">
                  Un compte sera créé automatiquement si vous n&apos;en avez pas encore.
                </p>
              </form>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6 sm:p-8 text-slate-400 animate-pulse">
            Chargement de l&apos;invitation…
          </div>
        </div>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}