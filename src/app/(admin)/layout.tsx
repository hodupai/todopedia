import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import "../globals.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/todo");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-lg font-bold">🔧 TODOPEDIA Admin</h1>
          <a href="/todo" className="text-sm text-neutral-400 hover:text-neutral-100">
            ← 앱으로 돌아가기
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
