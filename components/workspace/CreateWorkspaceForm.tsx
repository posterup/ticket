"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiCallError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * One question: what is it called.
 *
 * This asked three. A «نوع فضای کاری» chooser — «شخصی» against «کسب‌وکار» —
 * was the first thing on the page, above the name, as two large cards. Nobody
 * arrives here wanting to classify themselves; they arrive wanting to run an
 * event, and the type decides nothing. It is display-only: four surfaces render
 * it as a label and not one branches on it. A permanent, unexplained choice
 * placed ahead of the only field that matters, to set a caption.
 *
 * The optional bio went with it. It is real and stored, but it is page-polish
 * for a page that does not exist yet — better asked once there is a workspace
 * to describe than as a second hurdle before there is one.
 *
 * `type` is defaulted server-side (see `createWorkspaceSchema`). It is worth
 * knowing that nothing in the product can change it afterwards, so the default
 * is currently permanent; a workspace settings screen is where that belongs.
 */
export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * Actually create it.
   *
   * This was `router.push("/dashboard/events")` under a comment reading "Mock
   * create". It created nothing — and the navigation sent a person who still
   * had no workspace to a dashboard that refuses people with no workspace,
   * which bounced them to `/me`. The button appeared to do nothing at all.
   */
  async function submit() {
    if (busy) return;
    if (!name.trim()) {
      setError("نام فضای کاری الزامی است.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      /*
        A full navigation, not `router.push`. The session's membership is what
        the dashboard layout and the nav both read, and it was fetched before
        this workspace existed — a client-side push would arrive at the
        dashboard with a cached "not a manager" and bounce straight back out.
      */
      window.location.assign("/dashboard/events");
    } catch (e) {
      setError(
        e instanceof ApiCallError
          ? e.message
          : "ساخت فضای کاری انجام نشد. دوباره تلاش کنید.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
      <Field
        id="ws-name"
        label="نام فضای کاری"
        required
        error={error}
        hint="همین نام روی صفحهٔ عمومی و بلیت‌های شما دیده می‌شود."
      >
        <Input
          id="ws-name"
          value={name}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            // The only field on the page: Enter should finish it.
            if (e.key === "Enter") void submit();
          }}
          placeholder="مثلاً استودیو رویداد آوا"
          aria-invalid={Boolean(error)}
        />
      </Field>

      <div className="flex gap-3">
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "در حال ساخت…" : "ساخت فضای کاری"}
        </Button>
        {/* Back to where they came from, which for someone with no workspace
            is `/me` and not a dashboard that would refuse them. */}
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => router.push("/me")}
        >
          انصراف
        </Button>
      </div>
    </div>
  );
}
