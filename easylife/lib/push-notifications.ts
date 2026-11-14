export type FamilyPushModule = "planning" | "shopping" | "notes";
export type FamilyPushAction = "added" | "updated" | "removed";

export async function notifyFamilyChange(
  notification: {
    module: FamilyPushModule;
    action: FamilyPushAction;
    listId?: string;
  },
) {
  try {
    const response = await fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      console.error("La modification a été enregistrée, mais la notification push n'a pas été envoyée.", payload.error);
      return false;
    }

    const payload = (await response.json()) as { failed?: number };
    if (payload.failed) {
      console.error(`${payload.failed} notification(s) push n'ont pas pu être envoyées.`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("La modification a été enregistrée, mais le service de notification est inaccessible.", error);
    return false;
  }
}
