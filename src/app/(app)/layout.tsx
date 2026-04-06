import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ThemeProvider from "@/components/ThemeProvider";
import GoldProvider from "@/components/GoldProvider";
import ToastProvider from "@/components/Toast";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <GoldProvider>
        <ToastProvider>
          <div className="pixel-panel flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex flex-1 flex-col overflow-y-auto scrollbar-hide" style={{ backgroundColor: "var(--theme-bg-translucent)" }}>
              {children}
            </main>
            <BottomNav />
          </div>
        </ToastProvider>
      </GoldProvider>
    </ThemeProvider>
  );
}
