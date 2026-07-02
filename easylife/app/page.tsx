import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { Suspense } from "react";

type FamilyMembershipRow = {
  family_id?: string | null;
};

type PlanningEventSummaryRow = {
  id: string;
  child_id: string;
  title: string;
  start_at: string;
  end_at: string;
};

type CalendarEventSummaryRow = {
  id: string;
  title: string;
  start_at: string;
};

type ChildSummaryRow = {
  id: string;
  name: string;
};

type CalendarConnectionRow = {
  last_synced_at: string | null;
};

type DashboardNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "warning" | "info" | "success";
};

type DashboardSummary = {
  hasFamily: boolean;
  todayPlanningCount: number;
  upcomingCalendarCount: number;
  remainingShoppingCount: number;
  remainingNotesCount: number;
  weeklyMenuFilledSlots: number;
  todayPlanningPreview: Array<{
    id: string;
    title: string;
    childName: string;
    startLabel: string;
    endLabel: string;
  }>;
  nextCalendarPreview: Array<{
    id: string;
    title: string;
    whenLabel: string;
  }>;
  notifications: DashboardNotification[];
};

function GuestHome() {
  return (
    <>
      <section className="grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 text-xs font-semibold px-3 py-1 mb-5">
            Organisation familiale partagée
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight flex flex-wrap items-center gap-2 sm:gap-3">
            <Image
              src="/easy-life-logo-v2.svg"
              alt="Logo Easy Life"
              width={54}
              height={54}
              className="h-11 w-11 md:h-14 md:w-14 rounded-2xl shadow-sm"
              priority
            />
            <span className="inline-flex items-center rounded-full px-3 sm:px-5 py-1.5 text-2xl sm:text-3xl md:text-4xl font-black tracking-wide text-white bg-gradient-to-r from-rose-600 via-fuchsia-500 to-orange-500 shadow-sm">
              EASY LIFE
            </span>
          </h1>
          <p className="mt-5 text-lg md:text-xl text-slate-600 max-w-2xl">
            L&apos;application qui centralise le quotidien de votre famille: planning, courses, notes, adresses utiles et
            coordination des enfants.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/auth/sign-up"
              className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors text-center"
            >
              Créer un compte
            </Link>
            <Link
              href="/auth/login"
              className="bg-white hover:bg-slate-100 text-slate-700 px-8 py-3 rounded-xl font-semibold transition-colors border border-slate-200 text-center"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl border border-rose-100 shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Ce que vous pouvez faire</h2>
          <ul className="space-y-3 text-slate-600">
            <li className="flex gap-3">
              <span>🛒</span>
              <span>Créer plusieurs listes de courses partagées par famille</span>
            </li>
            <li className="flex gap-3">
              <span>🍽️</span>
              <span>Planifier le menu de la semaine et préparer les ingrédients</span>
            </li>
            <li className="flex gap-3">
              <span>📝</span>
              <span>Créer des listes de notes partagées ou privées</span>
            </li>
            <li className="flex gap-3">
              <span>📅</span>
              <span>Consulter un calendrier partagé synchronisé en lecture seule</span>
            </li>
            <li className="flex gap-3">
              <span>👧</span>
              <span>Planifier le quotidien de vos enfants (jusqu&apos;à 3)</span>
            </li>
            <li className="flex gap-3">
              <span>📍</span>
              <span>Stocker des adresses utiles avec notes (maison, école, travail)</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-20 grid md:grid-cols-3 gap-6">
        <article className="bg-white/75 rounded-xl border border-rose-100 p-6 shadow-sm">
          <p className="text-3xl mb-3">🤝</p>
          <h3 className="font-bold text-slate-800">Partage par famille</h3>
          <p className="text-slate-600 mt-2">Chaque espace est visible par tous les membres de la même famille.</p>
        </article>

        <article className="bg-white/75 rounded-xl border border-rose-100 p-6 shadow-sm">
          <p className="text-3xl mb-3">🎯</p>
          <h3 className="font-bold text-slate-800">Simple au quotidien</h3>
          <p className="text-slate-600 mt-2">Une interface claire, sans surcharge, pour aller droit à l&apos;essentiel.</p>
        </article>

        <article className="bg-white/75 rounded-xl border border-rose-100 p-6 shadow-sm">
          <p className="text-3xl mb-3">🔒</p>
          <h3 className="font-bold text-slate-800">Accès sécurisé</h3>
          <p className="text-slate-600 mt-2">Les données sont segmentées par famille via les règles d&apos;accès.</p>
        </article>
      </section>
    </>
  );
}

function ConnectedHome({
  email,
  summary,
}: {
  email: string | null | undefined;
  summary: DashboardSummary;
}) {
  return (
    <>
      <section className="bg-white/80 backdrop-blur rounded-2xl border border-rose-100 shadow-sm p-8 md:p-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-800 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="w-full sm:w-auto">Bienvenue sur</span>
          <Image
            src="/easy-life-logo-v2.svg"
            alt="Logo Easy Life"
            width={38}
            height={38}
            className="h-9 w-9 md:h-10 md:w-10 rounded-xl shadow-sm"
            priority
          />
          <span className="inline-flex items-center rounded-full px-3 sm:px-4 py-1 text-sm sm:text-base md:text-lg font-black tracking-wide text-white bg-gradient-to-r from-rose-600 via-fuchsia-500 to-orange-500 shadow-sm">
            EASY LIFE
          </span>
        </h1>
        <p className="mt-3 text-slate-600">Connecté en tant que <span className="font-medium">{email}</span></p>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <Link
            href="/protected/liste-courses"
            className="rounded-xl bg-white border border-slate-200 hover:border-rose-200 p-5 transition-colors"
          >
            <p className="text-2xl">🛒</p>
            <p className="font-semibold mt-2 text-slate-800">Courses</p>
            <p className="text-slate-500 text-sm mt-1">Listes partagées</p>
          </Link>

          <Link
            href="/protected/planning-enfants"
            className="rounded-xl bg-white border border-slate-200 hover:border-rose-200 p-5 transition-colors"
          >
            <p className="text-2xl">👧</p>
            <p className="font-semibold mt-2 text-slate-800">Planning enfants</p>
            <p className="text-slate-500 text-sm mt-1">Jusqu&apos;à 3 enfants</p>
          </Link>

          <Link
            href="/protected/menu-semaine"
            className="rounded-xl bg-white border border-slate-200 hover:border-rose-200 p-5 transition-colors"
          >
            <p className="text-2xl">🍽️</p>
            <p className="font-semibold mt-2 text-slate-800">Menu de la semaine</p>
            <p className="text-slate-500 text-sm mt-1">Repas + ingrédients</p>
          </Link>

          <Link
            href="/protected/adresses-utiles"
            className="rounded-xl bg-white border border-slate-200 hover:border-rose-200 p-5 transition-colors"
          >
            <p className="text-2xl">📍</p>
            <p className="font-semibold mt-2 text-slate-800">Adresses utiles</p>
            <p className="text-slate-500 text-sm mt-1">Maison, école, travail</p>
          </Link>

          <Link
            href="/protected/calendrier-externe"
            className="rounded-xl bg-white border border-slate-200 hover:border-rose-200 p-5 transition-colors"
          >
            <p className="text-2xl">📅</p>
            <p className="font-semibold mt-2 text-slate-800">Calendrier partagé</p>
            <p className="text-slate-500 text-sm mt-1">Lecture seule partagée</p>
          </Link>

          <Link
            href="/protected/notes"
            className="rounded-xl bg-white border border-slate-200 hover:border-rose-200 p-5 transition-colors"
          >
            <p className="text-2xl">📝</p>
            <p className="font-semibold mt-2 text-slate-800">Notes</p>
            <p className="text-slate-500 text-sm mt-1">Famille ou privé</p>
          </Link>

          <Link
            href="/protected/parametres"
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white p-5 transition-colors"
          >
            <p className="text-2xl">⚙️</p>
            <p className="font-semibold mt-2">Paramètres</p>
            <p className="text-rose-100 text-sm mt-1">Réglages des modules</p>
          </Link>
        </div>
      </section>

      <section className="mt-8 grid lg:grid-cols-5 gap-4">
        <article className="bg-white/80 rounded-xl border border-rose-100 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Aujourd&apos;hui - Planning enfants</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{summary.todayPlanningCount}</p>
          <p className="text-sm text-slate-600 mt-2">
            {summary.hasFamily
              ? "Activités prévues pour le jour en cours"
              : "Créez ou rejoignez une famille pour activer ce module"}
          </p>
          {summary.todayPlanningPreview.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              {summary.todayPlanningPreview.map((eventRow) => (
                <li key={eventRow.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{eventRow.title} · {eventRow.childName}</span>
                  <span className="text-slate-500 whitespace-nowrap">
                    {eventRow.startLabel}-{eventRow.endLabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        <article className="bg-white/80 rounded-xl border border-rose-100 p-5 shadow-sm">
          <p className="text-sm text-slate-500">24h - Calendrier partagé</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{summary.upcomingCalendarCount}</p>
          <p className="text-sm text-slate-600 mt-2">Événements prévus dans les prochaines 24 heures</p>
          {summary.nextCalendarPreview.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              {summary.nextCalendarPreview.map((eventRow) => (
                <li key={eventRow.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{eventRow.title}</span>
                  <span className="text-slate-500 whitespace-nowrap">{eventRow.whenLabel}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        <article className="bg-white/80 rounded-xl border border-rose-100 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Courses restantes</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{summary.remainingShoppingCount}</p>
          <p className="text-sm text-slate-600 mt-2">Articles non cochés sur vos listes de courses</p>
          <Link
            href="/protected/liste-courses"
            className="inline-flex mt-4 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors"
          >
            Ouvrir les courses
          </Link>
        </article>

        <article className="bg-white/80 rounded-xl border border-rose-100 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Notes restantes</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{summary.remainingNotesCount}</p>
          <p className="text-sm text-slate-600 mt-2">Eléments non cochés dans vos listes de notes visibles</p>
          <Link
            href="/protected/notes"
            className="inline-flex mt-4 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors"
          >
            Ouvrir les notes
          </Link>
        </article>

        <article className="bg-white/80 rounded-xl border border-rose-100 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Menu de la semaine</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{summary.weeklyMenuFilledSlots}/7</p>
          <p className="text-sm text-slate-600 mt-2">Dîners renseignés pour la semaine en cours</p>
          <Link
            href="/protected/menu-semaine"
            className="inline-flex mt-4 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors"
          >
            Ouvrir le menu
          </Link>
        </article>
      </section>

      <section className="mt-8 bg-white/80 rounded-xl border border-rose-100 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-slate-800">Notifications utiles</h2>
          <span className="text-xs text-slate-500">Priorités du jour</span>
        </div>

        {summary.notifications.length === 0 ? (
          <p className="text-sm text-slate-600">Rien d&apos;urgent pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {summary.notifications.map((notification) => (
              <li
                key={notification.id}
                className={`rounded border p-3 ${
                  notification.tone === "warning"
                    ? "bg-amber-50 border-amber-200"
                    : notification.tone === "success"
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-sky-50 border-sky-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{notification.detail}</p>
                  </div>
                  <Link
                    href={notification.href}
                    className="text-sm bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-200 transition-colors"
                  >
                    {notification.cta}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

async function PageContent() {
  const supabase = await createClient();
  const claimsResult = await Promise.race([
    supabase.auth.getClaims(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
  const claimsData = claimsResult?.data;
  const userId = claimsData?.claims?.sub ?? null;
  const userEmail = claimsData?.claims?.email ?? null;
  const userDisplayName = (claimsData?.claims as Record<string, unknown> | undefined)?.user_metadata
    ? ((claimsData!.claims as Record<string, unknown>).user_metadata as Record<string, string>)?.display_name ?? null
    : null;

  let summary: DashboardSummary = {
    hasFamily: false,
    todayPlanningCount: 0,
    upcomingCalendarCount: 0,
    remainingShoppingCount: 0,
    remainingNotesCount: 0,
    weeklyMenuFilledSlots: 0,
    todayPlanningPreview: [],
    nextCalendarPreview: [],
    notifications: [],
  };

  if (userId) {
    let familyId: string | null = null;

    const { data: rpcFamilyId, error: rpcFamilyIdError } = await supabase.rpc("user_family_id");
    if (!rpcFamilyIdError && rpcFamilyId) {
      familyId = rpcFamilyId as string;
    }

    if (!familyId) {
      const { data: membershipRows } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(1);

      familyId = ((membershipRows?.[0] as FamilyMembershipRow | undefined)?.family_id ?? null) as string | null;
    }

    if (familyId) {
      const now = new Date();
      const mondayOffset = (now.getDay() + 6) % 7;
      const mondayDate = new Date(now);
      mondayDate.setDate(now.getDate() - mondayOffset);
      mondayDate.setHours(0, 0, 0, 0);
      const mondayKey = mondayDate.toISOString().slice(0, 10);

      const [planningResult, calendarResult, shoppingResult, notesResult, childrenResult, connectionResult, weeklyMenuResult] = await Promise.all([
        supabase
          .from("family_child_planning_events")
          .select("id, child_id, title, start_at, end_at")
          .eq("family_id", familyId)
          .limit(200),
        supabase
          .from("family_calendar_events")
          .select("id, title, start_at")
          .eq("family_id", familyId)
          .gte("start_at", new Date().toISOString())
          .lt("start_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
          .order("start_at", { ascending: true })
          .limit(5),
        supabase
          .from("shopping_items")
          .select("id", { count: "planned", head: true })
          .eq("family_id", familyId)
          .eq("done", false),
        supabase
          .from("family_note_items")
          .select("id", { count: "planned", head: true })
          .eq("family_id", familyId)
          .eq("done", false),
        supabase.from("family_children").select("id, name").eq("family_id", familyId),
        supabase.from("family_calendar_connections").select("last_synced_at").eq("family_id", familyId).maybeSingle(),
        supabase
          .from("family_weekly_menu_items")
          .select("id", { count: "planned", head: true })
          .eq("family_id", familyId)
          .eq("meal_slot", "diner")
          .eq("week_start_date", mondayKey),
      ]);

      const todayWeekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
        new Date().getDay()
      ];

      const childNameById = new Map(
        ((childrenResult.data ?? []) as ChildSummaryRow[]).map((child) => [child.id, child.name]),
      );

      const planningRows = (planningResult.data ?? []) as PlanningEventSummaryRow[];
      const todayPlanningRows = planningRows
        .filter((eventRow) => {
          const day = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
            new Date(eventRow.start_at).getDay()
          ];
          return day === todayWeekday;
        })
        .sort((a, b) => a.start_at.localeCompare(b.start_at));

      const calendarRows = (calendarResult.data ?? []) as CalendarEventSummaryRow[];
      const connectionRow = (connectionResult.data as CalendarConnectionRow | null) ?? null;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const imminentPlanning = todayPlanningRows.find((eventRow) => {
        const startDate = new Date(eventRow.start_at);
        const eventMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const delta = eventMinutes - nowMinutes;
        return delta >= 0 && delta <= 90;
      });

      const notifications: DashboardNotification[] = [];

      if (imminentPlanning) {
        const childName = childNameById.get(imminentPlanning.child_id) ?? "Inconnu";
        notifications.push({
          id: "planning-imminent",
          title: "Activité enfant imminente",
          detail: `${imminentPlanning.title} (${childName}) commence bientôt.`,
          href: "/protected/planning-enfants",
          cta: "Voir le planning",
          tone: "warning",
        });
      }

      if (!connectionRow?.last_synced_at) {
        notifications.push({
          id: "calendar-never-synced",
          title: "Calendrier non synchronisé",
          detail: "Aucune synchronisation récente détectée pour le calendrier partagé.",
          href: "/protected/parametres/calendrier-partage",
          cta: "Configurer la synchro",
          tone: "warning",
        });
      } else {
        const minutesSinceSync = Math.floor((Date.now() - new Date(connectionRow.last_synced_at).getTime()) / 60000);
        if (minutesSinceSync > 120) {
          notifications.push({
            id: "calendar-sync-stale",
            title: "Synchro calendrier à rafraîchir",
            detail: `Dernière synchro il y a ${minutesSinceSync} min.`,
            href: "/protected/parametres/calendrier-partage",
            cta: "Rafraîchir",
            tone: "info",
          });
        }
      }

      if ((shoppingResult.count ?? 0) >= 8) {
        notifications.push({
          id: "shopping-high-volume",
          title: "Courses à traiter",
          detail: `${shoppingResult.count ?? 0} articles restent à acheter.`,
          href: "/protected/liste-courses",
          cta: "Ouvrir les courses",
          tone: "info",
        });
      }

      if (notifications.length === 0) {
        notifications.push({
          id: "all-good",
          title: "Tout est à jour",
          detail: "Aucune priorité détectée pour le moment.",
          href: "/",
          cta: "Rafraîchir",
          tone: "success",
        });
      }

      summary = {
        hasFamily: true,
        todayPlanningCount: todayPlanningRows.length,
        upcomingCalendarCount: calendarRows.length,
        remainingShoppingCount: shoppingResult.count ?? 0,
        remainingNotesCount: notesResult.count ?? 0,
        weeklyMenuFilledSlots: weeklyMenuResult.count ?? 0,
        todayPlanningPreview: todayPlanningRows.slice(0, 3).map((eventRow) => {
          const startDate = new Date(eventRow.start_at);
          const endDate = new Date(eventRow.end_at);
          return {
            id: eventRow.id,
            title: eventRow.title,
            childName: childNameById.get(eventRow.child_id) ?? "Inconnu",
            startLabel: startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            endLabel: endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          };
        }),
        nextCalendarPreview: calendarRows.slice(0, 3).map((eventRow) => ({
          id: eventRow.id,
          title: eventRow.title,
          whenLabel: new Date(eventRow.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        })),
        notifications,
      };
    }
  }

  return (
    <>
      {userId && <Navbar />}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-20">
        {!userId ? <GuestHome /> : <ConnectedHome email={userDisplayName ?? userEmail} summary={summary} />}
      </div>

      <footer className="border-t border-slate-200 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 text-center text-slate-500">
          <p>&copy; 2026 Easy Life. Application d&apos;organisation familiale.</p>
        </div>
      </footer>
    </>
  );
}

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100 text-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-16 animate-pulse">
          <div className="h-16 bg-rose-200 rounded mb-6 w-3/4 mx-auto"></div>
          <div className="h-8 bg-rose-200 rounded w-1/2 mx-auto mb-8"></div>
          <div className="h-6 bg-rose-200 rounded w-2/3 mx-auto"></div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-stone-50 via-rose-50 to-slate-100 text-slate-800">
      <Suspense fallback={<PageSkeleton />}>
        <PageContent />
      </Suspense>
    </main>
  );
}
