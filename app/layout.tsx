import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Assistente Virtual LPCC",
  description: "Assistente virtual da Liga Portuguesa Contra o Cancro",
  icons: { icon: "/avatar.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dd0000",
};

// Applies a saved light/dark choice before first paint, so the page doesn't flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("lpcc-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={openSans.className}>{children}</body>
    </html>
  );
}
