import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité | Easy Life",
  description: "Informations sur la collecte, l’usage et la protection des données dans Easy Life.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#fff,_#fdf2f8)] px-4 py-12 text-slate-800">
      <div className="mx-auto max-w-4xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-sm backdrop-blur sm:p-10">
        <p className="mb-4 inline-flex rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700">
          Publication mobile
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Politique de confidentialité</h1>
        <p className="mt-4 text-lg text-slate-600">
          Easy Life est une application familiale qui collecte uniquement les données nécessaires au bon fonctionnement des services proposés.
        </p>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">1. Données collectées</h2>
          <p className="text-slate-600">
            Nous collectons les informations de compte nécessaires à l’authentification, ainsi que les données saisies dans les modules famille, planning, courses, notes et adresses utiles.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">2. Utilisation des données</h2>
          <p className="text-slate-600">
            Les données sont utilisées pour permettre l’accès à votre espace familial, l’affichage des informations partagées et l’organisation du quotidien.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">3. Partage des données</h2>
          <p className="text-slate-600">
            Les informations partagées au sein d’une famille sont visibles uniquement par les membres autorisés de cette famille, selon les droits définis dans l’application.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">4. Sécurité</h2>
          <p className="text-slate-600">
            Nous mettons en place des mesures techniques et organisationnelles raisonnables pour protéger les données contre l’accès non autorisé ou l’altération.
          </p>
        </section>

        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold">5. Vos droits</h2>
          <p className="text-slate-600">
            Vous pouvez demander l’accès, la correction ou la suppression de vos données en contactant l’équipe de Easy Life.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white transition hover:bg-rose-700">
            Retour à l’accueil
          </Link>
          <Link href="/auth/sign-up" className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50">
            Créer un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
