"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/branding";

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export function NavBar() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-block h-6 w-6 rounded bg-blue-600" />
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/dashboard" className="hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/profile" className="hover:text-slate-900">
            Career Profile
          </Link>
          <Link href="/jobs" className="hover:text-slate-900">
            Jobs
          </Link>
          <Link href="/gaps" className="hover:text-slate-900">
            Skill Gaps
          </Link>
          <Link href="/learning" className="hover:text-slate-900">
            Learning
          </Link>
          <Link href="/skill-roi" className="hover:text-slate-900">
            Skill ROI
          </Link>
          <Link href="/career-path" className="hover:text-slate-900">
            Career Path
          </Link>
          <Link href="/applications" className="hover:text-slate-900">
            Applications
          </Link>
          <Link href="/cv-builder" className="hover:text-slate-900">
            CV Builder
          </Link>
          <Link href="/cover-letters" className="hover:text-slate-900">
            Cover Letters
          </Link>
          <Link href="/interview-coach" className="hover:text-slate-900">
            Interview Coach
          </Link>
          <Link href="/skills-passport" className="hover:text-slate-900">
            Skills Passport
          </Link>
          <Link href="/linkedin-optimizer" className="hover:text-slate-900">
            LinkedIn Optimizer
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-slate-900">
              Admin
            </Link>
          )}
          <Link href="/billing" className="hover:text-slate-900">
            Billing
          </Link>
          {user === undefined ? null : user ? (
            <>
              <span className="text-slate-400">{user.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
