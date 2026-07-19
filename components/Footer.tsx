import { Logo } from "@/components/Logo";
import { PublicBottomNav } from "@/components/PublicBottomNav";

/** Minimal footer: brand mark and a copyright line, plus the mobile bottom nav. */
export function Footer() {
  return (
    <>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <Logo />
          <p>© تمامی حقوق برای پوستر محفوظ است.</p>
        </div>
      </footer>
      {/* Clears the fixed mobile bottom nav so footer content stays visible. */}
      <div className="h-16 sm:hidden" aria-hidden />
      <PublicBottomNav />
    </>
  );
}
