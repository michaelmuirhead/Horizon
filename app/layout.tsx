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
    // Order matters: browsers pick the first supported entry. PNGs first
    // because iOS Safari and older Android Chrome ignore SVG home-screen
    // icons and fall back to a screenshot of the page if they can't find
    // a raster icon. SVG stays last as a higher-DPI fallback for browsers
    // that prefer it (modern desktop Chrome, etc.).
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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
