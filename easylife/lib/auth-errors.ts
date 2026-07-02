export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Une erreur s'est produite. Veuillez réessayer.";
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("limit exceeded")) {
    return "Trop de demandes d'email. Réessayez dans quelques minutes.";
  }

  return message;
}