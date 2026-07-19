import { Logo } from "@/components/Logo";

/** Minimal footer: brand mark and a copyright line. */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <Logo />
        <p>© تمامی حقوق برای گیشه محفوظ است.</p>
      </div>
    </footer>
  );
}
