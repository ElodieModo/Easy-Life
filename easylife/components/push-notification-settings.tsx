"use client";

import { useEffect, useState } from "react";

type PushStatus = "checking" | "ready" | "unsupported" | "missing-key" | "subscribed" | "error";

const decodeVapidKey = (key: string) => {
  const padded = key + "=".repeat((4 - (key.length % 4)) % 4);
  const decoded = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

export function PushNotificationSettings() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkSupport = async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
      setIsIos(ios);
      setIsInstalled(installed);

      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("unsupported");
        return;
      }

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setStatus("missing-key");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(subscription ? "subscribed" : "ready");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Impossible de préparer les notifications sur cet appareil.");
        }
      }
    };

    void checkSupport();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      if (Notification.permission === "denied") {
        throw new Error("Les notifications sont bloquées dans les réglages de votre navigateur.");
      }

      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Autorisez les notifications pour les recevoir sur ce téléphone.");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error(payload.error ?? "Impossible d'activer les notifications.");
      }

      setStatus("subscribed");
      setMessage("Les notifications sont activées sur cet appareil.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Impossible d'activer les notifications.");
    } finally {
      setIsSaving(false);
    }
  };

  const unsubscribe = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setStatus("ready");
        return;
      }

      const response = await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Impossible de désactiver les notifications.");
      }

      await subscription.unsubscribe();
      setStatus("ready");
      setMessage("Les notifications sont désactivées sur cet appareil.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Impossible de désactiver les notifications.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-sky-100 bg-sky-50/60 p-5 sm:p-6" aria-labelledby="push-settings-heading">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl">🔔</span>
        <div className="min-w-0 flex-1">
          <h2 id="push-settings-heading" className="text-lg font-semibold text-slate-800">
            Notifications sur ce téléphone
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Recevez une alerte quand un proche modifie le planning, les courses ou les notes partagées. Vos propres
            changements ne déclenchent pas de notification.
          </p>

          {isIos && !isInstalled ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Sur iPhone, ajoutez d&apos;abord Easy Life à l&apos;écran d&apos;accueil depuis le menu Partager de Safari,
              puis ouvrez l&apos;icône installée. iOS 16.4 ou plus récent est nécessaire.
            </p>
          ) : null}
          {status === "unsupported" ? (
            <p className="mt-3 text-sm text-rose-700">Les notifications push ne sont pas prises en charge par ce navigateur.</p>
          ) : null}
          {status === "missing-key" ? (
            <p className="mt-3 text-sm text-amber-800">Le service de notifications n&apos;est pas encore configuré.</p>
          ) : null}
          {status === "subscribed" ? (
            <p className="mt-3 text-sm font-medium text-emerald-800">Notifications activées sur cet appareil.</p>
          ) : null}
          {message ? (
            <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>
          ) : null}

          {status === "ready" || status === "subscribed" || status === "error" ? (
            <button
              type="button"
              onClick={status === "subscribed" ? unsubscribe : subscribe}
              disabled={isSaving || (isIos && !isInstalled)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSaving
                ? "Mise à jour..."
                : status === "subscribed"
                  ? "Désactiver sur cet appareil"
                  : "Activer les notifications"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
