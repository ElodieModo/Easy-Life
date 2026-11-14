import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

async function getActiveMembership() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { response: NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 }) };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { response: NextResponse.json({ error: "Impossible de trouver votre famille." }, { status: 500 }) };
  }

  if (!membership) {
    return { response: NextResponse.json({ error: "Rejoignez une famille avant d'activer les notifications." }, { status: 400 }) };
  }

  return { supabase, user, familyId: membership.family_id };
}

export async function POST(request: Request) {
  let subscription: SubscriptionBody;
  try {
    subscription = (await request.json()) as SubscriptionBody;
  } catch {
    return NextResponse.json({ error: "Données de notification invalides." }, { status: 400 });
  }

  if (
    typeof subscription.endpoint !== "string" ||
    !subscription.endpoint.startsWith("https://") ||
    typeof subscription.keys?.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  ) {
    return NextResponse.json({ error: "Abonnement de notification incomplet." }, { status: 400 });
  }

  const membership = await getActiveMembership();
  if ("response" in membership) return membership.response;

  const admin = createAdminClient();
  const { error } = await admin.from("family_push_subscriptions").upsert(
    {
      family_id: membership.familyId,
      user_id: membership.user.id,
      endpoint: subscription.endpoint,
      subscription,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("Impossible d'enregistrer l'abonnement push:", error.message);
    return NextResponse.json({ error: "Impossible d'enregistrer cet appareil." }, { status: 500 });
  }

  return NextResponse.json({ status: "subscribed" });
}

export async function DELETE(request: Request) {
  let body: { endpoint?: string };
  try {
    body = (await request.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "Données de notification invalides." }, { status: 400 });
  }

  if (typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "Adresse d'abonnement invalide." }, { status: 400 });
  }

  const membership = await getActiveMembership();
  if ("response" in membership) return membership.response;

  const admin = createAdminClient();
  const { error } = await admin
    .from("family_push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", membership.user.id);

  if (error) {
    console.error("Impossible de supprimer l'abonnement push:", error.message);
    return NextResponse.json({ error: "Impossible de désactiver les notifications sur cet appareil." }, { status: 500 });
  }

  return NextResponse.json({ status: "unsubscribed" });
}
