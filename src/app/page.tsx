import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/branding";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="inline-block h-12 w-12 rounded-xl bg-blue-600" />
      <h1 className="mt-6 text-3xl font-bold text-slate-900">{APP_NAME}</h1>
      <p className="mt-3 max-w-md text-slate-600">{APP_DESCRIPTION}</p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/register"
          className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-white"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
