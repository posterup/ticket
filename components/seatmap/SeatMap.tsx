"use client";

/**
 * The customer seat picker.
 *
 * Progressive by construction:
 *
 *  1. The overview loads first — section shapes only, no seats. Orientation.
 *  2. Choosing a section fetches just that section's seats and renders them on
 *     a canvas laid over its place in the map. Every other section stays as a
 *     dimmed block, so spatial context is never lost.
 *  3. Switching sections swaps what is *rendered*, while the last few decoded
 *     sections stay cached — comparing VIP against the balcony does not refetch.
 *
 * Small venues skip step 1's modality entirely: below
 * `directRenderThreshold` the first section opens on arrival, because a
 * mandatory drill-in on a 400-seat theatre costs a tap and buys nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { apiFetch, ApiCallError } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatNumber, formatToman } from "@/lib/format";
import { boundsOf } from "@/lib/venues/geometry";
import { dropLapsed, earliestDeadline } from "@/lib/venues/selection";
import { AsyncState } from "@/components/ui/async-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { HoldResult, SeatDetail, StandingSelection } from "@/types";

import { BestAvailable, type BestAvailableResult } from "./BestAvailable";
import { SectionCanvas } from "./SectionCanvas";
import { SeatList } from "./SeatList";
import { VenueOverview } from "./VenueOverview";
import {
  prefetchSection,
  useAvailability,
  useOverview,
  useSectionSeats,
  useSectionStatus,
} from "./useSeatmap";
import { fitBox, useCamera, type Camera } from "./useCamera";
import { usePop, useReveal } from "./useReveal";
import { useHoldTimer } from "./useHoldTimer";

interface Props {
  sessionId: string;
  layoutVersionId: string;
  onSelectionChange?: (seats: SeatDetail[]) => void;
  /** Standing sections are bought by quantity, not by seat. */
  onStandingChange?: (standing: StandingSelection | null) => void;
  /**
   * Bumped by the parent when the *server* refused the order over seats.
   *
   * The countdown here and the sweep on the server do not agree, and cannot:
   * `releaseExpiredOrders` runs at the top of `createOrder`, so the very
   * request that reads a hold can be the one that expires it — while this
   * clock, a second behind or a second ahead, still shows time left. When that
   * happens checkout used to print «زمان نگه‌داری صندلی‌ها تمام شد» *above a map
   * with the seats still lit and selected*, and pressing the button again
   * failed the same way. The buyer was left holding a contradiction with no way
   * out of it but a reload.
   *
   * A nonce rather than a callback because the parent is reporting an event,
   * not asking a question: each new value means "re-check, the server said no".
   */
  resyncNonce?: number;
  className?: string;
}

export function SeatMap({
  sessionId,
  layoutVersionId,
  onSelectionChange,
  onStandingChange,
  resyncNonce = 0,
  className,
}: Props) {
  const overview = useOverview(layoutVersionId);
  const availability = useAvailability(sessionId);
  const [sectionKey, setSectionKey] = useState<string | null>(null);
  /**
   * Picks, keyed by section.
   *
   * This used to be one flat `Set<number>` while `sectionKey` moved
   * independently, so opening a second section carried the first one's indices
   * into it: the summary printed the new section's name against the old
   * section's seats, another customer's held seat could render as yours where
   * the indices happened to collide, and the original holds stayed on the
   * server — invisible, unbuyable, and still counting against the ten-seat cap.
   *
   * Full `SeatDetail` rather than bare indices, because labels can only be
   * resolved while that section's geometry is loaded. Keeping them lets a buyer
   * hold seats in the stalls and the balcony at once, which the order endpoint
   * has always accepted.
   */
  const [picks, setPicks] = useState<Record<string, SeatDetail[]>>({});
  const [holdError, setHoldError] = useState<string | null>(null);
  /**
   * When each section's holds lapse, keyed the same way as the picks.
   *
   * Not one deadline: `holdSeats` stamps `now + 20 minutes` at the moment of
   * *each* acquisition, so seats taken ten minutes apart expire ten minutes
   * apart. Keeping a single value meant the last response overwrote the others
   * and the countdown showed the newest — a buyer watched «۱۹:۵۸» while the
   * seats they picked first were already gone.
   */
  const [expiries, setExpiries] = useState<Record<string, string>>({});

  // Read inside the timer callback, which the timer holds across ticks — going
  // through state there would close over whichever values existed when the
  // countdown started.
  const picksRef = useRef<Record<string, SeatDetail[]>>({});
  const expiriesRef = useRef<Record<string, string>>({});
  const [holding, setHolding] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [standingQty, setStandingQty] = useState(0);
  /** Until the server has been asked, we do not know what is already held. */
  const [restored, setRestored] = useState(false);

  const seats = useSectionSeats(layoutVersionId, sectionKey);
  const status = useSectionStatus(sessionId, sectionKey);

  const reduced = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.4);

  // The camera has to know the frame it is filling, or a wide stand gets
  // cropped to the container's aspect and the ends of every row fall outside.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAspect(width / height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const availabilityByKey = useMemo(
    () =>
      new Map(
        (availability.data?.sections ?? []).map((s) => [s.key, s]),
      ),
    [availability.data],
  );

  /** The span of seat prices in the house, for the budget control. */
  const priceSpan = useMemo(() => {
    const prices = (availability.data?.sections ?? [])
      .map((s) => s.priceFrom)
      .filter((p): p is number => p !== undefined);
    if (!prices.length) return {};
    return { from: Math.min(...prices), to: Math.max(...prices) };
  }, [availability.data]);

  const section = overview.data?.sections.find((s) => s.key === sectionKey);
  const sectionInfo = sectionKey ? availabilityByKey.get(sectionKey) : undefined;

  /**
   * Recover the seats this browser is already holding.
   *
   * Holds live on the server for twenty minutes and survive a reload, but the
   * selection state does not — so without this a refresh mid-checkout showed a
   * customer their *own* seats greyed out as if someone else had them, while
   * those same seats still counted against their ten-seat cap. They could
   * neither see them nor replace them.
   *
   * Runs once per showing, before the small-venue shortcut, so a restored
   * section wins over the default choice.
   */
  useEffect(() => {
    let live = true;
    setRestored(false);
    apiFetch<{ section: string; seats: number[]; expiresAt: string }[]>(
      `/api/sessions/${sessionId}/holds`,
    )
      .then((held) => {
        if (!live) return;
        // Every group, not just the first. Restoring one section and dropping
        // the rest left real holds on the server that the buyer could neither
        // see nor release, while they still counted against the ten-seat cap.
        // Labels arrive when each section's geometry loads.
        const restoredPicks: Record<string, SeatDetail[]> = {};
        for (const group of held) {
          if (!group.seats.length) continue;
          restoredPicks[group.section] = group.seats.map((index) => ({
            index,
            section: group.section,
            sectionName: "",
            rowLabel: "",
            seatLabel: "",
            kind: "standard",
          }));
        }
        const first = held.find((h) => h.seats.length);
        if (first) {
          setPicks(restoredPicks);
          setSectionKey(first.section);
          setExpiries(
            Object.fromEntries(held.map((g) => [g.section, g.expiresAt])),
          );
        }
        setRestored(true);
      })
      .catch(() => live && setRestored(true));
    return () => {
      live = false;
    };
  }, [sessionId]);

  /**
   * A small venue has nothing to gain from the two-step flow, so it opens a
   * section immediately.
   *
   * Which section matters: opening the *first* one greets a customer with an
   * empty grid whenever the closest tier has sold out, which is exactly when it
   * is most likely to have. Prefer the first seated section with something left,
   * and only fall back to the first outright if the whole venue is gone.
   *
   * Waits for availability so the choice is informed rather than a guess that
   * has to be corrected a moment later.
   */
  const small =
    overview.data && overview.data.totalSeats <= overview.data.directRenderThreshold;
  useEffect(() => {
    if (!small || sectionKey || !overview.data) return;
    if (!restored || !availability.data) return;

    const seated = overview.data.sections.filter((s) => s.kind === "seated");
    const open =
      seated.find((s) => (availabilityByKey.get(s.key)?.available ?? 0) > 0) ??
      seated[0];
    if (open) setSectionKey(open.key);
  }, [small, sectionKey, overview.data, availability.data, availabilityByKey, restored]);

  /**
   * Where the camera wants to be: the whole venue, or the open section.
   *
   * Memoised on the numbers rather than the object so `useCamera` is not
   * re-targeted with an identical box every render, which would restart the
   * flight on every poll tick.
   */
  const target: Camera = useMemo(() => {
    const bounds = overview.data?.bounds ?? { width: 1000, height: 800 };
    const whole = { x: 0, y: 0, w: bounds.width, h: bounds.height };
    if (!section) return fitBox(whole, aspect, 0.02);
    return fitBox(boundsOf(section.shape), aspect, 0.18);
  }, [overview.data?.bounds, section, aspect]);

  const camera = useCamera(target, reduced);

  // Restarts per section, so drilling in replays the entrance.
  const reveal = useReveal(seats.data ? sectionKey : null, reduced);
  const { popped, pop } = usePop();

  /**
   * Blocked seats join `sold` for rendering: from a buyer's side both mean
   * "not yours to take". They are kept apart on the wire because they mean
   * different things to the organiser — nobody bought a house seat, and it
   * will never free up.
   */
  /** Indices selected in the section currently on screen. */
  const selected = useMemo(
    () => new Set((picks[sectionKey ?? ""] ?? []).map((p) => p.index)),
    [picks, sectionKey],
  );

  /**
   * The soonest any of this buyer's seats lapse.
   *
   * The earliest, not the latest: that is the moment they start losing seats,
   * and a countdown that reassures someone right up until their booking
   * silently shrinks is worse than no countdown.
   */
  const holdExpiresAt = useMemo(
    () => earliestDeadline(picks, expiries),
    [picks, expiries],
  );

  useEffect(() => {
    picksRef.current = picks;
    expiriesRef.current = expiries;
  }, [picks, expiries]);

  /** Everything picked, across every section. */
  const allPicks = useMemo(
    () => Object.values(picks).flat().filter(Boolean),
    [picks],
  );

  const sold = useMemo(
    () => new Set([...(status.data?.sold ?? []), ...(status.data?.blocked ?? [])]),
    [status.data],
  );
  const held = useMemo(() => {
    // Seats this customer holds are theirs, not "someone else's" — subtract the
    // current selection so their own picks never render as unavailable.
    const all = new Set(status.data?.held ?? []);
    for (const i of selected) all.delete(i);
    return all;
  }, [status.data, selected]);

  const detail = useCallback(
    (indices: Set<number>): SeatDetail[] => {
      if (!seats.data || !section) return [];
      return [...indices].sort((a, b) => a - b).map((i) => {
        const row = seats.data!.rows.find(
          (r) => i >= r.from && i < r.from + r.count,
        );
        return {
          index: i,
          section: section.key,
          sectionName: section.name,
          rowLabel: row?.label ?? "",
          seatLabel: seats.data!.label[i],
          kind: "standard",
          price: sectionInfo?.priceFrom,
        };
      });
    },
    [seats.data, section, sectionInfo],
  );

  useEffect(() => {
    onSelectionChange?.(allPicks);
  }, [allPicks, onSelectionChange]);

  /**
   * Fill in labels for picks restored before their geometry arrived.
   *
   * A reload knows *which* seats are held but not what they are called until
   * the section loads, so those entries start with empty labels and are
   * upgraded here rather than shown to the buyer as «ردیف  صندلی ».
   */
  useEffect(() => {
    if (!sectionKey || !seats.data) return;
    setPicks((prev) => {
      const mine = prev[sectionKey];
      if (!mine?.length || mine.every((p) => p.seatLabel)) return prev;
      return { ...prev, [sectionKey]: detail(new Set(mine.map((p) => p.index))) };
    });
  }, [sectionKey, seats.data, detail]);

  /**
   * Toggling a seat takes or releases a real server-side hold.
   *
   * Selection is not a client-side notion here: an optimistic tick that turns
   * out to be someone else's seat is exactly the failure this design exists to
   * prevent, so the seat only lights up once the server says it is ours.
   */
  const toggle = useCallback(
    async (index: number) => {
      if (!sectionKey || holding) return;
      setHoldError(null);

      if (selected.has(index)) {
        setPicks((prev) => {
          const next = {
            ...prev,
            [sectionKey]: (prev[sectionKey] ?? []).filter(
              (p) => p.index !== index,
            ),
          };
          if (!next[sectionKey].length) {
            setExpiries((e) => {
              const rest = { ...e };
              delete rest[sectionKey];
              return rest;
            });
          }
          return next;
        });
        await apiFetch(`/api/sessions/${sessionId}/holds`, {
          method: "DELETE",
          body: JSON.stringify({ section: sectionKey, seats: [index] }),
        }).catch(() => {
          // A failed release is harmless — the hold lapses on its own.
        });
        return;
      }

      setHolding(true);
      try {
        const result = await apiFetch<HoldResult>(
          `/api/sessions/${sessionId}/holds`,
          {
            method: "POST",
            body: JSON.stringify({ section: sectionKey, seats: [index] }),
          },
        );
        const won = detail(new Set(result.acquired));
        setPicks((prev) => ({
          ...prev,
          [sectionKey]: [...(prev[sectionKey] ?? []), ...won].sort(
            (a, b) => a.index - b.index,
          ),
        }));
        setExpiries((e) => ({ ...e, [sectionKey]: result.expiresAt }));
        for (const i of result.acquired) pop(i);
      } catch (error) {
        const message =
          error instanceof ApiCallError
            ? error.message
            : "انتخاب صندلی ممکن نشد.";
        setHoldError(message);
        status.reload();
      } finally {
        setHolding(false);
      }
    },
    [sectionKey, sessionId, selected, holding, status, pop, detail],
  );

  /**
   * A deadline passed while they were filling in the form.
   *
   * Drops only what actually lapsed. Sections are held on separate clocks, so
   * clearing the whole selection here would throw away seats the buyer still
   * has — the countdown fires on the *earliest* deadline, which is usually not
   * the only one.
   *
   * Stale ticks have to go either way: a seat still lit after its hold expired
   * is how someone reaches checkout and is told it is gone.
   */
  const onHoldExpired = useCallback(() => {
    const result = dropLapsed(picksRef.current, expiriesRef.current, Date.now());
    if (!result.lapsed.length) return;

    setPicks(result.picks);
    setExpiries(result.expiries);
    setHoldError(
      result.partial
        ? "زمان نگه‌داری بخشی از صندلی‌ها تمام شد. دوباره انتخابشان کنید."
        : "زمان نگه‌داری صندلی‌ها تمام شد. لطفاً دوباره انتخاب کنید.",
    );
    status.reload();
  }, [status]);

  const hold = useHoldTimer(allPicks.length ? holdExpiresAt : null, onHoldExpired);

  /**
   * The server refused. Re-check rather than argue with it.
   *
   * `dropLapsed` against *now* clears anything this side already agrees is
   * dead, and `status.reload()` re-reads sold/held from the session so a seat
   * someone else won stops looking available. Between them the map and the
   * message finally say the same thing, and the buyer can pick again instead of
   * re-submitting the same refusal.
   *
   * Skips the first render: a nonce that starts at zero has not fired yet.
   */
  const lastResync = useRef(resyncNonce);
  useEffect(() => {
    if (resyncNonce === lastResync.current) return;
    lastResync.current = resyncNonce;

    const result = dropLapsed(picksRef.current, expiriesRef.current, Date.now());
    if (result.lapsed.length) {
      setPicks(result.picks);
      setExpiries(result.expiries);
    }
    status.reload();
  }, [resyncNonce, status]);

  // Picks are keyed by section, so switching is now just a change of view —
  // nothing to clear, and nothing left behind.
  const openSection = useCallback((key: string) => {
    setSectionKey(key);
    setHoldError(null);
    setStandingQty(0);
  }, []);

  /**
   * The server picked, and already took the seats.
   *
   * Land the buyer *on the map* at what they were given rather than showing a
   * receipt for it — being shown where you will be sitting is most of what the
   * map is for, and it leaves swapping a seat one tap away instead of a restart.
   */
  const applyBest = useCallback(
    (result: BestAvailableResult) => {
      setSectionKey(result.section);
      setStandingQty(0);
      // The response already names the row and every seat, so the summary reads
      // correctly before the section's geometry has even been fetched.
      setPicks({
        [result.section]: result.seats.map((index, i) => ({
          index,
          section: result.section,
          sectionName: result.sectionName,
          rowLabel: result.rowLabel,
          seatLabel: result.seatLabels[i] ?? "",
          kind: "standard",
          price: result.unitPrice,
        })),
      });
      setExpiries({ [result.section]: result.expiresAt });
      setHoldError(null);
      for (const i of result.seats) pop(i);
    },
    [pop],
  );

  useEffect(() => {
    if (!onStandingChange) return;
    if (section?.kind !== "standing" || standingQty < 1 || !sectionInfo?.ticketTypeId) {
      onStandingChange(null);
      return;
    }
    onStandingChange({
      section: section.key,
      sectionName: section.name,
      ticketTypeId: sectionInfo.ticketTypeId,
      quantity: standingQty,
      price: sectionInfo.priceFrom,
    });
  }, [section, standingQty, sectionInfo, onStandingChange]);

  if (!overview.data) {
    return (
      <div className={cn("min-h-64 p-6", className)}>
        <AsyncState loading={overview.loading} error={overview.error} />
      </div>
    );
  }

  /**
   * Every section's picks, priced from its own section.
   *
   * This used to multiply the open section's price by the whole selection,
   * which was only ever right because the selection could not span sections.
   * Now that it can, each pick is priced where it sits.
   */
  const total = allPicks.reduce(
    (sum, p) =>
      sum + (p.price ?? availabilityByKey.get(p.section)?.priceFrom ?? 0),
    0,
  );

  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row", className)}>
      {/* Map column */}
      <div
        ref={stageRef}
        className="relative min-h-[320px] flex-1 overflow-hidden rounded-xl border border-border bg-card sm:min-h-[460px]"
      >
        <VenueOverview
          overview={overview.data}
          availability={availabilityByKey}
          selectedKey={sectionKey}
          onSelect={openSection}
          onPrefetch={(key) => prefetchSection(layoutVersionId, key)}
          dimUnselected={Boolean(sectionKey)}
          camera={camera}
          zoomed={Boolean(sectionKey && seats.data)}
        />

        {/* Shares the camera with the overview, so the seats stay pinned to
            their section for the whole flight in. */}
        {sectionKey && seats.data ? (
          <div className="absolute inset-0">
            <SectionCanvas
              seats={seats.data}
              sold={sold}
              held={held}
              selected={selected}
              onToggle={toggle}
              camera={camera}
              reveal={reveal}
              popped={popped}
              color={
                section?.color.startsWith("#")
                  ? section.color
                  : `var(--${section?.color})`
              }
            />
          </div>
        ) : null}

        {sectionKey && seats.loading ? (
          /* Seats arriving, shaped like seats. The overview stays visible
             underneath, so this is a veil over the section being opened
             rather than a replacement for the map. */
          <div
            role="status"
            aria-busy="true"
            aria-label="در حال بارگذاری صندلی‌ها"
            className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm"
          >
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 5 }, (_, row) => (
                <div key={row} className="flex gap-1.5">
                  {Array.from({ length: 9 }, (_, seat) => (
                    <Skeleton key={seat} className="size-4 rounded-[3px]" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {sectionKey && !small ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSectionKey(null)}
            className="absolute top-3 end-3 shadow-sm"
          >
            نمای کلی سالن
          </Button>
        ) : null}
      </div>

      {/* Picker column */}
      <div className="flex w-full flex-col gap-3 lg:max-w-sm">
        {/* The default path. Hidden once they have seats of their own, because
            replacing a considered choice with a guess is not an improvement. */}
        {restored && allPicks.length === 0 ? (
          <BestAvailable
            sessionId={sessionId}
            priceFrom={priceSpan.from}
            priceTo={priceSpan.to}
            maxQuantity={10}
            onFound={applyBest}
          />
        ) : null}

        {!sectionKey ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground">
              یک بخش را انتخاب کنید
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              برای دیدن صندلی‌ها، روی بخشی از نقشه بزنید. ظرفیت کل این سالن{" "}
              {formatNumber(overview.data.totalSeats)} نفر است.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {overview.data.sections.map((s) => {
                const info = availabilityByKey.get(s.key);
                const out = info?.indicator === "sold-out";
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      disabled={out}
                      onPointerEnter={() => prefetchSection(layoutVersionId, s.key)}
                      onFocus={() => prefetchSection(layoutVersionId, s.key)}
                      onClick={() => openSection(s.key)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        out
                          ? "cursor-not-allowed text-faint"
                          : "hover:border-accent hover:bg-subtle",
                      )}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted">
                        {out
                          ? "تکمیل"
                          : info?.priceFrom !== undefined
                            ? `از ${formatToman(info.priceFrom)}`
                            : `${formatNumber(s.capacity)} ظرفیت`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {sectionKey && section?.kind === "standing" ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground">{section.name}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              این بخش ایستاده است و صندلی شماره‌دار ندارد؛ فقط تعداد را انتخاب
              کنید.
            </p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">تعداد بلیت</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="کاهش تعداد"
                  disabled={standingQty <= 0}
                  onClick={() => setStandingQty((q) => Math.max(0, q - 1))}
                  className="grid size-11 place-items-center rounded-lg border border-field-border text-lg text-foreground outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-10 text-center text-base font-bold tabular-nums text-foreground">
                  {formatNumber(standingQty)}
                </span>
                <button
                  type="button"
                  aria-label="افزایش تعداد"
                  // Same ceiling as the seated cap, and never past what is left.
                  disabled={
                    standingQty >= Math.min(10, sectionInfo?.available ?? 0)
                  }
                  onClick={() => setStandingQty((q) => q + 1)}
                  className="grid size-11 place-items-center rounded-lg border border-field-border text-lg text-foreground outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {standingQty > 0 && sectionInfo?.priceFrom !== undefined ? (
              <p className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted">جمع</span>
                <span className="font-bold text-foreground">
                  {formatToman(sectionInfo.priceFrom * standingQty)}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {sectionKey && seats.data && section?.kind === "seated" ? (
          /*
            `flex flex-col`, not just a max-height.

            `SeatList` asks for `h-full` and puts its rows in an
            `overflow-y-auto` box. A percentage height resolves against the
            parent's *height*, and this card only had a `max-height` — so
            `h-full` computed to `auto`, the scroll box was never constrained,
            and a section with twenty rows rendered its whole list straight out
            through the bottom of the card. A flex column with a capped height
            is what makes `flex-1 min-h-0` inside it actually shrink and scroll.
          */
          <div className="flex max-h-[420px] flex-col rounded-xl border border-border bg-card p-4">
            <SeatList
              seats={seats.data}
              sectionName={section.name}
              sold={sold}
              held={held}
              selected={selected}
              onToggle={toggle}
              price={sectionInfo?.priceFrom}
              accessibleOnly={accessibleOnly}
              onAccessibleOnlyChange={setAccessibleOnly}
            />
          </div>
        ) : null}

        {holdError ? (
          <p
            role="status"
            className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-text"
          >
            {holdError}
          </p>
        ) : null}

        {allPicks.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {formatNumber(allPicks.length)} صندلی
              </span>
              <span className="font-bold text-foreground">
                {formatToman(total)}
              </span>
            </div>

            {/* Grouped by section, because the selection may now span several
                and «ردیف A صندلی ۱۲» means nothing without saying where. */}
            <ul className="mt-1.5 flex flex-col gap-1">
              {Object.entries(picks)
                .filter(([, list]) => list.length)
                .map(([key, list]) => {
                  const name =
                    list[0]?.sectionName ||
                    overview.data?.sections.find((x) => x.key === key)?.name ||
                    key;
                  // Labels are absent until that section's geometry loads, so
                  // fall back to a count rather than «ردیف  صندلی ».
                  const labelled = list.every((p) => p.seatLabel);
                  return (
                    <li key={key} className="text-xs text-muted">
                      <span className="font-medium text-foreground">{name}</span>
                      {": "}
                      {labelled
                        ? list
                            .map((p) => `ردیف ${p.rowLabel} صندلی ${p.seatLabel}`)
                            .join("، ")
                        : `${formatNumber(list.length)} صندلی`}
                    </li>
                  );
                })}
            </ul>
            {hold.phase !== "none" ? (
              <p
                // Polite: an urgent live region would interrupt a screen reader
                // every second.
                aria-live="polite"
                className={cn(
                  "mt-2 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium tabular-nums",
                  hold.phase === "warning"
                    ? "bg-danger/10 text-danger-text"
                    : "bg-subtle text-muted",
                )}
              >
                <span>نگه‌داری صندلی</span>
                <span>{hold.label}</span>
              </p>
            ) : null}
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              این صندلی‌ها به‌طور موقت برای شما نگه داشته شده‌اند.
            </p>
          </div>
        ) : null}

        <Legend
          color={
            section
              ? section.color.startsWith("#")
                ? section.color
                : `var(--${section.color})`
              : undefined
          }
        />
      </div>
    </div>
  );
}

/**
 * The key to the map — which has to be a key to *this* map.
 *
 * Two things were wrong with the old one. It swatched «آزاد» as `bg-success`
 * while the free seats on screen were whatever colour the section authored, so
 * the legend named a green that appeared nowhere. And it drew all four states
 * as the same filled dot in four colours, which is the exact encoding the
 * canvas had to stop relying on: see `RADIUS_SCALE` in `SectionCanvas` for the
 * measurements. A legend that says «رزرو موقت» is a dot, when a held seat is a
 * *small* dot and a sold seat is a *hollow ring*, teaches the reader the one
 * distinction that will not help them.
 *
 * So the swatches are the shapes, and «آزاد» borrows the open section's colour.
 */
function Legend({ color }: { color?: string }) {
  const items = [
    { label: "آزاد", shape: "size-2.5 rounded-full", style: { background: color ?? "var(--muted)" } },
    { label: "انتخاب شما", shape: "size-2.5 rounded-full bg-accent" },
    { label: "رزرو موقت", shape: "size-1.5 rounded-full bg-faint" },
    { label: "فروخته‌شده", shape: "size-2.5 rounded-full border-[1.5px] border-faint" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {/* Fixed box so the smaller «رزرو موقت» dot still sits on the line. */}
          <span className="grid size-2.5 shrink-0 place-items-center" aria-hidden>
            <span className={cn(i.shape)} style={i.style} />
          </span>
          {i.label}
        </li>
      ))}
    </ul>
  );
}
