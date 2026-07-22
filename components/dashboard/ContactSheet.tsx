"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import { X, Plus, CalendarDays, Wallet, Phone, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber, formatToman } from "@/lib/format";
import type { Contact } from "@/components/dashboard/ContactsTable";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** True at the `lg` breakpoint (desktop) — drives sheet-vs-popup presentation. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * A single contact's detail view. On mobile it's a bottom sheet (90% tall,
 * swipe the handle down to dismiss); on desktop it's a centered popup.
 */
export function ContactSheet({
  contact,
  allTags,
  onSetTags,
  onClose,
}: {
  contact: Contact | null;
  allTags: string[];
  onSetTags: (id: string, tags: string[]) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const isDesktop = useIsDesktop();
  const controls = useDragControls();
  const [draft, setDraft] = useState("");
  const open = contact !== null;

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function addTag(label: string) {
    if (!contact) return;
    const t = label.trim();
    if (!t || contact.tags.includes(t)) return;
    onSetTags(contact.id, [...contact.tags, t]);
  }

  function removeTag(label: string) {
    if (!contact) return;
    onSetTags(
      contact.id,
      contact.tags.filter((x) => x !== label),
    );
  }

  const suggestions = contact
    ? allTags.filter((t) => !contact.tags.includes(t))
    : [];

  return (
    <AnimatePresence>
      {open && contact && (
        <motion.div
          key="contact-sheet"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />

          {/* Centering layer (desktop popup); on mobile the panel anchors to the bottom itself. */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              isDesktop && "flex items-center justify-center p-4",
            )}
          >
            <motion.div
              className={cn(
                "pointer-events-auto flex flex-col border-border bg-background shadow-2xl shadow-foreground/10",
                isDesktop
                  ? "w-full max-w-lg max-h-[85vh] rounded-2xl border"
                  : "absolute inset-x-0 bottom-0 mx-auto h-[90dvh] max-w-lg rounded-t-2xl border-t",
              )}
              role="dialog"
              aria-modal="true"
              aria-label={`مخاطب ${contact.fullName}`}
              initial={
                reduce
                  ? false
                  : isDesktop
                    ? { opacity: 0, scale: 0.96 }
                    : { y: "100%" }
              }
              animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : isDesktop
                    ? { opacity: 0, scale: 0.96 }
                    : { y: "100%" }
              }
              transition={{ duration: isDesktop ? 0.2 : 0.32, ease: EASE_OUT }}
              drag={isDesktop ? false : "y"}
              dragListener={false}
              dragControls={controls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) onClose();
              }}
            >
              {/* Drag handle — mobile only. */}
              {!isDesktop ? (
                <div
                  onPointerDown={(e) => controls.start(e)}
                  className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-3 active:cursor-grabbing"
                >
                  <span className="h-1.5 w-11 rounded-full bg-border-strong" />
                </div>
              ) : null}

              {/* Header */}
              <div
                className={cn(
                  "flex items-start gap-3 px-5 pb-4",
                  isDesktop && "pt-5",
                )}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-foreground text-base font-bold text-background">
                  {contact.fullName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {contact.fullName}
                  </p>
                  <p
                    className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"
                    dir="ltr"
                  >
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    {contact.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="بستن"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 pb-8">
                {/* Insight card */}
                <div className="grid grid-cols-2 gap-3">
                  <Insight
                    icon={CalendarDays}
                    label="رویدادها"
                    value={formatNumber(contact.events.length)}
                  />
                  <Insight
                    icon={Wallet}
                    label="مجموع خرید"
                    value={formatToman(contact.spent)}
                  />
                </div>

                {/* Tags */}
                <section className="mt-6 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    برچسب‌ها
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    برچسب‌ها را برای دسته‌بندی این مخاطب تنظیم کنید.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {contact.tags.length === 0 ? (
                      <span className="text-xs text-faint">
                        هنوز برچسبی ندارد.
                      </span>
                    ) : (
                      contact.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pe-1.5 ps-2.5 text-xs font-medium text-accent"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            aria-label={`حذف برچسب ${t}`}
                            className="grid size-4 place-items-center rounded-full transition-colors hover:bg-accent/15"
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Add a tag */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addTag(draft);
                      setDraft("");
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="برچسب جدید…"
                      className="h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-border-strong focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="grid size-10 shrink-0 place-items-center rounded-md bg-foreground text-background outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95 disabled:opacity-40"
                      aria-label="افزودن برچسب"
                    >
                      <Plus className="size-5" aria-hidden />
                    </button>
                  </form>

                  {suggestions.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs text-faint">برچسب‌های پیشنهادی</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestions.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => addTag(t)}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                          >
                            <Plus className="size-3" aria-hidden />
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>

                {/* Events joined */}
                <section className="mt-6 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    رویدادهای شرکت‌کرده
                  </h3>

                  {contact.events.length === 0 ? (
                    <p className="mt-3 text-xs text-faint">
                      در هیچ رویدادی شرکت نکرده است.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {contact.events.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-subtle text-muted">
                            <CalendarDays className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {ev.title}
                            </p>
                            {ev.dateLabel ? (
                              <p className="mt-0.5 text-xs text-muted">
                                {ev.dateLabel}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Insight({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-subtle p-4">
      <Icon className="size-4 text-faint" aria-hidden />
      <p className="mt-2 text-lg font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
