import "server-only";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Returns the current user if they are an ADMIN, otherwise null.
 * Admin routes must call this (never just getCurrentUser) — regular
 * authenticated users must never reach admin data or actions.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return null;
  }
  return user;
}
