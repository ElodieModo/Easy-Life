import Link from "next/link";

export const metadata = {
  title: "Préparation App Store | Easy Life",
  description: "Checklist de préparation pour la publication mobile et l’App Store.",
};

export default function AppStorePreparationPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#fff,_#fdf2f8)] px-4 py-12 text-slate-800">
      <div className="mx-auto max-w-5xl rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-sm backdrop-blur sm:p-10">
        <p className="mb-4 inline-flex rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700">
          Préparation publication
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">Checklist de préparation pour la publication mobile</h1>
        <p className="mt-4 text-lg text-slate-600">
          Cette page rassemble les éléments à finaliser avant une publication web, puis une future version iOS compatible App Store.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold">État actuel</h2>
            <ul className="mt-4 space-y-2 text-slate-600">
              <li>✓ Application web fonctionnelle et buildée avec succès</li>
              <li>✓ Manifest PWA présent</li>
              <li>✓ Icônes Apple et PWA disponibles</li>
              <li>⚠️ Pas encore de packaging iOS natif</li>
              <li>⚠️ Pas encore de signature Apple / provisioning</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold">À préparer</h2>
            <ul className="mt-4 space-y-2 text-slate-600">
              <li>• Ajouter une politique de confidentialité complète</li>
              <li>• Vérifier les permissions nécessaires</li>
              <li>• Préparer les captures d’écran et la description</li>
              <li>• Configurer le packaging iOS et la signature</li>
              <li>• Tester sur vrai iPhone avant soumission</li>
            </ul>
          </section>
        </div>

        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="text-xl font-semibold text-slate-800">Prochaine étape recommandée</h2>
          <p className="mt-2 text-slate-600">
            Commencer par une version web installable et mobile-friendly, puis convertir l’application vers un conteneur iOS avec Capacitor ou Expo.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/politique-confidentialite" className="rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white transition hover:bg-rose-700">
            Voir la politique de confidentialité
          </Link>
          <Link href="/" className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
