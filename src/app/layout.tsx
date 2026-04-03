import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TODOPEDIA",
  description: "투두 + 다마고치 게이미피케이션 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="flex h-full justify-center bg-[#1a1a2e] bg-cover bg-center bg-no-repeat antialiased" style={{ backgroundImage: "url('/ui/bg-forest.jpg')" }}>
        <div className="flex h-full w-full max-w-[480px] flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
