"use client";

import { createContext, useContext } from "react";

import { useApi } from "@/lib/client/api";

/** Mirror of `SessionUser` in `lib/server/auth/session.ts`, as it lands on the wire. */
export interface SessionUser {
  id: string;
  phone: string;
  fullName: string | null;
  avatarUrl: string | null;
  platformAdmin: boolean;
}

export interface SessionMembership {
  workspaceId: string;
  role: string;
}

export interface Session {
  user: SessionUser | null;
  memberships: SessionMembership[];
  /** True until `/api/auth/me` has answered once. */
  loading: boolean;
}

/**
 * Who is signed in, fetched once for the whole document.
 *
 * `AppShell` already asked `/api/auth/me` to decide which chrome to draw, and
 * `useApi` has no cache — so every other component that needed the answer had
 * to either fire the same request again or, as `PublicHeader` did, guess. It
 * guessed "signed out", which is why a signed-in reader was offered «ورود».
 *
 * A duplicate fetch would have fixed the button and left a subtler bug: two
 * components resolving the same question at two different moments, so the
 * header and the shell disagree about who you are for as long as the slower
 * request takes. One provider means one answer, arriving everywhere at once.
 */
const SessionContext = createContext<Session>({
  user: null,
  memberships: [],
  loading: true,
});

interface MeResponse {
  user: SessionUser | null;
  memberships: SessionMembership[];
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data, loading } = useApi<MeResponse>("/api/auth/me");
  const user = data?.user ?? null;

  return (
    <SessionContext.Provider
      value={{
        user,
        memberships: data?.memberships ?? [],
        // `loading` alone flickers back to true on a reload; the reader is not
        // un-signed-in while it refreshes, so treat "answered once" as settled.
        loading: loading && !data,
      }}
    >
      {/*
        The same answer, for CSS.

        `globals.css` hides any header marked `.auth-mobile-hide` below `lg`
        when `[data-auth="in"]` is set on an ancestor — because a signed-in
        reader already has `AppChrome`'s fixed top bar, and a page that draws
        its own header would stack a second one under it. Nothing ever set the
        attribute, so the rule never matched and every signed-in mobile page
        carried two headers: the shell's, and its own.

        An element rather than an effect on `document.documentElement`. An
        effect resolves a frame *after* `AppShell` renders the chrome from this
        very context, and that frame is exactly the one with both headers in it
        — the bug, briefly, on every navigation. Rendering it here means the
        attribute and the chrome come from one value in one commit.

        `display: contents` so this generates no box: it is an ancestor for the
        selector and nothing at all for layout.
      */}
      <div data-auth={user ? "in" : "out"} className="contents">
        {children}
      </div>
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  return useContext(SessionContext);
}
