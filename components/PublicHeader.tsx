"use client";

import Link from "next/link";
import { User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useSession } from "@/lib/client/session";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * Solid public header for content pages (events browsing).
 *
 * A Client Component only because of the account slot: everything else here is
 * static markup, but the end of the bar has to know whether anyone is signed
 * in. It used to render «ورود» unconditionally, so a reader with a perfectly
 * good session was invited to sign in on every public page — and following that
 * invitation is how you end up signing out of a session that was working.
 *
 * The answer comes from the shared `SessionProvider`, not a fetch of its own,
 * so this and `AppShell` flip at the same instant instead of the header briefly
 * contradicting the chrome below it.
 */
export function PublicHeader() {
  return (
    <header className="auth-mobile-hide border-b border-border bg-card">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="پوستر، صفحه اصلی"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/feed"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            دنبال‌شده‌ها
          </Link>
          <Link
            href="/events"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            رویدادها
          </Link>
          <Link
            href="/pages"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            برگزارکنندگان
          </Link>
          <Link
            href="/me"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            من
          </Link>
        </nav>

        <AccountSlot />
      </div>
    </header>
  );
}

/**
 * «ورود», an avatar, or neither — in a box that is the same size in all three.
 *
 * The slot holds its width while the session resolves. Without that the bar
 * settles a beat after it paints, which is the one shift a reader is guaranteed
 * to be looking at: it happens at the top of every page, on every navigation.
 */
function AccountSlot() {
  const { user, loading } = useSession();

  return (
    <div className="flex h-9 min-w-14 shrink-0 items-center justify-end">
      {loading ? null : user ? (
        <Link
          href="/me"
          aria-label="حساب من"
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="hidden max-w-32 truncate text-sm text-muted sm:block">
            {user.fullName ?? "حساب من"}
          </span>
          <Avatar user={user} />
        </Link>
      ) : (
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          ورود
        </Link>
      )}
    </div>
  );
}

function Avatar({
  user,
}: {
  user: { fullName: string | null; avatarUrl: string | null; phone: string };
}) {
  if (user.avatarUrl) {
    return (
      // Not `next/image`: the source is a Blob URL on a host that is only known
      // at runtime, and this is a 36px square that gains nothing from a
      // resizing pipeline.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className="size-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  /*
    A neutral person glyph, the same one for everybody without a picture — the
    same call `WorkspaceAvatar` makes for a workspace with no logo. The initial
    that used to sit here came from `fullName`, which is optional (an account is
    created from a phone number and a name is asked for later), so it fell
    through to «؟» often enough to read as an error rather than an empty slot.
  */
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-muted"
    >
      <User className="size-1/2" />
    </span>
  );
}
