import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "TODOPEDIA",
  description: "투두 + 다마고치 게이미피케이션 웹앱",
  applicationName: "TODOPEDIA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TODOPEDIA",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f5e6d0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="flex h-full justify-center bg-[#1a1a2e] antialiased">
        <div className="flex h-full w-full max-w-[480px] flex-col">
          {children}
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
