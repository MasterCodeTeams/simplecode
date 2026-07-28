import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Master Code",
  description: "Web editor GitHub — edit, commit, branch, release, langsung dari browser.",
  icons: {
    // Google Search mensyaratkan ukuran favicon kelipatan 48px (48/96/144/192,
    // dst) buat bisa dipakai jadi icon di hasil pencarian — icon.png lama
    // ukurannya 1254x1254 (bukan kelipatan 48), makanya Google gak makein
    // dan nampilin globe generik. icon-*.png di bawah ini ukurannya sudah
    // bener.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  // Safari/iOS gak baca manifest.json buat mode "Add to Home Screen",
  // jadi butuh meta tag appleWebApp ini biar statusnya standalone juga
  // (address bar hilang) pas dibuka dari icon di home screen iPhone.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Master Code",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8282815899964290"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
