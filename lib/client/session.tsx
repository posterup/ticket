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

  return (
    <SessionContext.Provider
      value={{
        user: data?.user ?? null,
        memberships: data?.memberships ?? [],
        // `loading` alone flickers back to true on a reload; the reader is not
        // un-signed-in while it refreshes, so treat "answered once" as settled.
        loading: loading && !data,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  return useContext(SessionContext);
}
