/**
 * Central branding configuration (Spec: "product name, logo, colors, URLs,
 * email sender information, and branding can easily be changed later").
 * UI and metadata should import from here rather than hardcoding strings.
 */
export const APP_NAME = "AI Career Navigator";
export const APP_DESCRIPTION =
  "Your AI-powered career agent: profile, job fit, skill gaps, learning, and applications in one place.";
export const APP_URL = process.env.APP_URL || "http://localhost:3000";
export const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@example.com";

export const BRAND_COLORS = {
  primary: "#2563eb", // blue-600
  primaryDark: "#1d4ed8", // blue-700
  accent: "#0f172a", // slate-900
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};
