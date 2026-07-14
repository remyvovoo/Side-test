import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { getLocaleServer } from "@/lib/i18n/get-locale-server";

export const metadata: Metadata = {
  title: "Cardshot — Photos studio pour tes cartes",
  description: "Transforme une photo de carte en visuels studio professionnels. 6 angles générés automatiquement.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocaleServer();

  return (
    <html lang={locale}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"
        />
      </head>
      <body>
        <AuthSessionProvider>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
