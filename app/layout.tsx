import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/layout/PWARegister";
import { HorizonStoreProvider } from "@/components/store/HorizonStore";
import { AuthProvider } from "@/components/auth/AuthContext";
import CloudSyncBridge from "@/components/auth/CloudSyncBridge";

export const metadata: Metadata = {
  title: "Horizon",
  description: "Envelope-style budgeting in the spirit of YNAB.",
  applicationName: "Horizon",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Horizon",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#06070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-page text-fg font-sans">
        <AuthProvider>
          <HorizonStoreProvider>
            <CloudSyncBridge />
            {children}
          </HorizonStoreProvider>
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
