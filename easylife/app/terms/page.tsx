import Link from "next/link";

export const metadata = {
  title: "Conditions d’utilisation | Easy Life",
  description: "Conditions générales d’utilisation de l’application Easy Life.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#fff,_#fdf2f8)] px-4 py-12 text-slate-800">
      <div className="mx-auto max-w-4xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-sm backdrop-blur sm:p-10">
        <h1 className="text-3xl font-bold sm:text-4xl">Conditions d’utilisation</h1>
        <p className="mt-4 text-lg text-slate-600">
          Easy Life propose un service d’organisation familiale destiné à faciliter la coordination du quotidien.
        </p>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">1. Utilisation du service</h2>
          <p className="text-slate-600">
            L’utilisateur s’engage à utiliser l’application de manière responsable et conforme à la législation applicable.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">2. Contenu partagé</h2>
          <p className="text-slate-600">
            Les utilisateurs sont responsables des informations qu’ils publient dans les espaces familiaux partagés.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">3. Limitation de responsabilité</h2>
          <p className="text-slate-600">
            Easy Life fournit un service d’aide à l’organisation sans garantir l’absence de toute erreur ou interruption.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white transition hover:bg-rose-700">
            Retour à l’accueil
          </Link>
          <Link href="/politique-confidentialite" className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </main>
  );
}
