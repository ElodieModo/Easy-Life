import { NextResponse } from "next/server";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PushModule = "planning" | "shopping" | "notes";
type PushAction = "added" | "updated" | "removed";
type NotifyBody = {
  module?: PushModule;
  action?: PushAction;
  listId?: string;
};

const notificationCopy: Record<PushModule, Record<PushAction, { title: string; body: string; url: string }>> = {
  planning: {
    added: { title: "Planning mis à jour", body: "Une activité a été ajoutée au planning familial.", url: "/protected/planning-enfants" },
    updated: { title: "Planning mis à jour", body: "Une activité du planning familial a été modifiée.", url: "/protected/planning-enfants" },
    removed: { title: "Planning mis à jour", body: "Une activité a été supprimée du planning familial.", url: "/protected/planning-enfants" },
  },
  shopping: {
    added: { title: "Liste de courses mise à jour", body: "Un article a été ajouté à une liste familiale.", url: "/protected/liste-courses" },
    updated: { title: "Liste de courses mise à jour", body: "Un article d'une liste familiale a été actualisé.", url: "/protected/liste-courses" },
    removed: { title: "Liste de courses mise à jour", body: "Un article a été supprimé d'une liste familiale.", url: "/protected/liste-courses" },
  },
  notes: {
    added: { title: "Notes familiales mises à jour", body: "Une note a été ajoutée à une liste partagée.", url: "/protected/notes" },
    updated: { title: "Notes familiales mises à jour", body: "Une note d'une liste partagée a été actualisée.", url: "/protected/notes" },
    removed: { title: "Notes familiales mises à jour", body: "Une note a été supprimée d'une liste partagée.", url: "/protected/notes" },
  },
};

export async function POST(request: Request) {
  let body: NotifyBody;
  try {
    body = (await request.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Données de notification invalides." }, { status: 400 });
  }

  if (
    (body.module !== "planning" && body.module !== "shopping" && body.module !== "notes") ||
    (body.action !== "added" && body.action !== "updated" && body.action !== "removed")
  ) {
    return NextResponse.json({ error: "Type de notification invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: "Impossible de trouver votre famille." }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Aucune famille active." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (body.module === "shopping" || body.module === "notes") {
    if (!body.listId) {
      return NextResponse.json({ error: "La liste concernée est requise." }, { status: 400 });
    }

    if (body.module === "shopping") {
      const { data: list, error } = await admin
        .from("shopping_lists")
        .select("id")
        .eq("id", body.listId)
        .eq("family_id", membership.family_id)
        .maybeSingle();

      if (error) {
        console.error("Impossible de vérifier la liste de courses:", error.message);
        return NextResponse.json({ error: "Impossible de vérifier la liste familiale." }, { status: 500 });
      }
      if (!list) {
        return NextResponse.json({ error: "Liste familiale introuvable." }, { status: 404 });
      }
    } else {
      const { data: list, error } = await admin
        .from("family_note_lists")
        .select("id, visibility")
        .eq("id", body.listId)
        .eq("family_id", membership.family_id)
        .maybeSingle();

      if (error) {
        console.error("Impossible de vérifier la liste de notes:", error.message);
        return NextResponse.json({ error: "Impossible de vérifier la liste de notes." }, { status: 500 });
      }
      if (!list || list.visibility !== "family") {
        return NextResponse.json({ status: "skipped", reason: "private-or-missing-list" });
      }
    }
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("family_push_subscriptions")
    .select("id, user_id, subscription")
    .eq("family_id", membership.family_id)
    .neq("user_id", user.id);

  if (subscriptionsError) {
    console.error("Impossible de charger les abonnements push:", subscriptionsError.message);
    return NextResponse.json({ error: "Impossible de préparer les notifications." }, { status: 500 });
  }
  if (!subscriptions?.length) {
    return NextResponse.json({ status: "sent", count: 0 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "Les clés de notifications push ne sont pas configurées sur le serveur." }, { status: 503 });
  }

  setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify(notificationCopy[body.module][body.action]);
  const deliveryResults = await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await sendNotification(row.subscription as Parameters<typeof sendNotification>[0], payload);
        return true;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode: unknown }).statusCode)
            : null;
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await admin
            .from("family_push_subscriptions")
            .delete()
            .eq("id", row.id);
          if (deleteError) {
            console.error("Impossible de retirer un abonnement push expiré:", deleteError.message);
          }
        } else {
          console.error("Échec d'envoi d'une notification push:", error);
        }
        return false;
      }
    }),
  );

  const sentCount = deliveryResults.filter(Boolean).length;
  return NextResponse.json({ status: "sent", count: sentCount, failed: deliveryResults.length - sentCount });
}
