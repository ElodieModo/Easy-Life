"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
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
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.rpc("accept_family_invite", { invite_token: token });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setMessage("Invitation acceptée. Redirection vers vos paramètres...");
      setIsLoading(false);
      router.push("/protected/parametres");
      router.refresh();
    };

    void applyInvite();
  }, [router, supabase, token]);

  const encodedNext = encodeURIComponent(`/auth/invitation?token=${token}`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">Invitation famille</h1>
        <p className="text-slate-600 mb-4">
          Cette page permet de rejoindre automatiquement la famille partagée via le lien reçu.
        </p>

        {isLoading ? <p className="text-slate-500">Traitement de l&apos;invitation...</p> : null}

        {message ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !message ? (
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <Link
              href={`/auth/login?next=${encodedNext}`}
              className="text-center bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href={`/auth/sign-up?next=${encodedNext}`}
              className="text-center bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded font-medium transition-colors"
            >
              Créer un compte
            </Link>
          </div>
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
          <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-6 sm:p-8 text-slate-500">
            Chargement de l&apos;invitation...
          </div>
        </div>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}