import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

async function SignUpSuccessContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params?.next ? decodeURIComponent(params.next) : "/";

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Inscription réussie !
              </CardTitle>
              <CardDescription>Bienvenue chez Easy-Life</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.
                </p>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
                  className="inline-block w-full bg-black text-white p-2 rounded font-medium text-center hover:bg-gray-900 transition-colors"
                >
                  Se connecter
                </Link>
                <p className="text-xs text-center text-gray-500">
                  Si vous ne recevez pas d&apos;email de confirmation, vous pouvez quand même vous connecter avec vos identifiants.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Chargement...</div>}>
      <SignUpSuccessContent searchParams={searchParams} />
    </Suspense>
  );
}
