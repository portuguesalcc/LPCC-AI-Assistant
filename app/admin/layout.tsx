import type { Metadata } from "next";

// Keep the admin page out of search engines.
export const metadata: Metadata = {
  title: "Administração — Assistente Virtual LPCC",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
