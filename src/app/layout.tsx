import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/branding";
import { NavBar } from "@/components/NavBar";

// System font stack rather than next/font/google: avoids a build-time
// dependency on fonts.googleapis.com (unreachable from some deployment
// environments/sandboxes) while still looking clean and native everywhere.
export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
