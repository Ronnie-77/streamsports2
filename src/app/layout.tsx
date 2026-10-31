import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { AdInjector } from "@/components/ad-injector";
import { getBranding } from "@/lib/admin";

// Dynamic metadata driven by the admin-controlled site branding so the
// browser tab title + icons reflect the configured name/logo everywhere.
export async function generateMetadata(): Promise<Metadata> {
  let name = "StreamSpatial";
  let logo: string | null = null;
  try {
    const b = await getBranding();
    name = b.siteName || name;
    logo = b.siteLogo;
  } catch {
    /* fall back to defaults */
  }
  const title = `${name} — Live Sports in Spatial HD`;
  const description = `Watch live sports streams on ${name} — football, cricket, NBA, NFL, UFC & more in a beautiful spatial interface.`;
  const icons = logo ? { icon: logo, shortcut: logo, apple: logo } : undefined;
  return {
    title,
    description,
    keywords: [
      "live sports",
      "streaming",
      "football",
      "cricket",
      "UFC",
      "NBA",
      "NFL",
      "boxing",
      "spatial UI",
    ],
    authors: [{ name }],
    icons,
    openGraph: { title, description, type: "website" },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {children}
          <AdInjector />
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
