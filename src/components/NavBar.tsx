"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/branding";

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Profile",
    links: [
      { href: "/profile", label: "Career Profile" },
      { href: "/skills-passport", label: "Skills Passport" },
    ],
  },
  {
    label: "Jobs",
    links: [
      { href: "/jobs", label: "Jobs" },
      { href: "/gaps", label: "Skill Gaps" },
      { href: "/skill-roi", label: "Skill ROI" },
    ],
  },
  {
    label: "Apply",
    links: [
      { href: "/cv-builder", label: "CV Builder" },
      { href: "/cover-letters", label: "Cover Letters" },
      { href: "/interview-coach", label: "Interview Coach" },
      { href: "/applications", label: "Applications" },
    ],
  },
  {
    label: "Grow",
    links: [
      { href: "/learning", label: "Learning" },
      { href: "/career-path", label: "Career Path" },
      { href: "/linkedin-optimizer", label: "LinkedIn Optimizer" },
    ],
  },
];

export function NavBar() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function closeMenus() {
    setOpenGroup(null);
    setMobileOpen(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href;
  }

  function groupIsActive(group: NavGroup) {
    return group.links.some((l) => isActive(l.href));
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="inline-block h-6 w-6 rounded bg-blue-600" />
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        {/* Desktop nav */}
        <nav ref={navRef} className="hidden items-center gap-1 text-sm lg:flex">
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-1.5 font-medium ${
              isActive("/dashboard")
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Dashboard
          </Link>

          {GROUPS.map((group) => (
            <div key={group.label} className="relative">
              <button
                onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 font-medium ${
                  groupIsActive(group)
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {group.label}
                <svg
                  className={`h-3 w-3 transition-transform ${openGroup === group.label ? "rotate-180" : ""}`}
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {openGroup === group.label && (
                <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMenus}
                      className={`block px-4 py-2 text-sm ${
                        isActive(link.href)
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={`rounded-md px-3 py-1.5 font-medium ${
                isActive("/admin")
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right side: user/billing/auth */}
        <div className="hidden items-center gap-3 text-sm lg:flex">
          {user === undefined ? null : user ? (
            <>
              <Link
                href="/billing"
                className={`rounded-md px-3 py-1.5 font-medium ${
                  isActive("/billing")
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                Billing
              </Link>
              <span className="hidden max-w-[160px] truncate text-slate-400 xl:inline">{user.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              Log in
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Link href="/dashboard" onClick={closeMenus} className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Dashboard
          </Link>
          {GROUPS.map((group) => (
            <div key={group.label} className="mt-2">
              <p className="px-3 text-xs font-semibold uppercase text-slate-400">{group.label}</p>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenus}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          {user?.role === "ADMIN" && (
            <Link href="/admin" onClick={closeMenus} className="mt-2 block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Admin
            </Link>
          )}
          <div className="mt-3 border-t border-slate-100 pt-3">
            {user ? (
              <>
                <Link href="/billing" onClick={closeMenus} className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Billing
                </Link>
                <p className="truncate px-3 py-1 text-xs text-slate-400">{user.email}</p>
                <button
                  onClick={handleLogout}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={closeMenus}
                className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
