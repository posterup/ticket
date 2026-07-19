"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Plus,
  AlertCircle,
  Globe,
  Link2,
  Lock,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatJalaliDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SectionCard, Toggle, Stepper } from "@/components/create/ui";
import { TemplatePicker } from "@/components/create/TemplatePicker";
import type { ComposerTemplate } from "@/lib/create/templates";
import { MediaSection } from "@/components/create/MediaSection";
import { TicketDesignSection } from "@/components/create/TicketDesignSection";
import { SessionsEditor } from "@/components/create/SessionsEditor";
import { TicketEditor, type SessionOption } from "@/components/create/TicketEditor";
import { EventPreview } from "@/components/create/EventPreview";
import type { TicketSample } from "@/components/tickets/TicketPreview";
import {
  LOCATION_LABELS,
  VISIBILITY_LABELS,
  VISIBILITY_HINTS,
} from "@/lib/create/labels";
import {
  initialDraft,
  emptySession,
  emptyTicket,
  expandSessions,
  EVENT_CATEGORIES,
  type CreateDraft,
  type LocationMode,
  type ScheduleMode,
  type Visibility,
  type TicketTypeDraft,
} from "@/lib/create/types";
import { validateDraft, type DraftErrors } from "@/lib/create/validation";
import type { WeekDay } from "@/types";

const LOCATION_MODES: LocationMode[] = ["in-person", "online", "hybrid"];
const VIS_ICON = { public: Globe, unlisted: Link2, private: Lock } as const;

const STEP_TITLES = ["رویداد", "زمان‌بندی", "بلیت‌ها"];

/** Error keys owned by each step, so Next validates only that step. */
function stepErrorKeys(step: number, draft: CreateDraft): string[] {
  if (step === 0) return ["title", "venueName", "city", "onlineUrl"];
  if (step === 1) return ["sessions"];
  return ["privacy", "tickets", ...draft.ticketTypes.map((t) => `ticket-${t.id}`)];
}

type Status = "idle" | "submitting" | "success" | "error";

function iso(date: string, time: string): string {
  return `${date}T${(time || "00:00")}:00.000Z`;
}

function ticketPrice(t: TicketTypeDraft): number {
  if (t.kind === "free") return 0;
  if (t.kind === "donation") return Math.max(0, Math.floor(Number(t.minPrice) || 0));
  return Math.max(0, Math.floor(Number(t.price) || 0));
}

export function EventComposer() {
  const [draft, setDraft] = useState<CreateDraft>(initialDraft);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState("");
  const [createdTitle, setCreatedTitle] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  function goNext() {
    const errs = validateDraft(draft);
    const keys = stepErrorKeys(step, draft);
    const stepErrs: DraftErrors = {};
    for (const k of keys) if (errs[k]) stepErrs[k] = errs[k];
    if (Object.keys(stepErrs).length > 0) {
      setErrors(stepErrs);
      setStatus("error");
      setSubmitError("لطفاً خطاهای این مرحله را برطرف کنید.");
      return;
    }
    setErrors({});
    setStatus("idle");
    setSubmitError("");
    if (step < STEP_TITLES.length - 1) setStep(step + 1);
    else void submit();
  }
  function goBack() {
    setStatus("idle");
    setErrors({});
    setSubmitError("");
    setStep((s) => Math.max(0, s - 1));
  }

  const applyTemplate = (t: ComposerTemplate) => {
    const seeded = t.build();
    // Keep a title the user may have already typed.
    setDraft((d) => ({ ...seeded, title: d.title || seeded.title }));
    setErrors({});
    setTemplate(t.id);
  };
  const clearTemplate = () => {
    setDraft((d) => ({ ...initialDraft, title: d.title }));
    setErrors({});
    setTemplate(null);
  };

  const patch = (p: Partial<CreateDraft>) => setDraft((d) => ({ ...d, ...p }));
  const patchLocation = (p: Partial<CreateDraft["location"]>) =>
    setDraft((d) => ({ ...d, location: { ...d.location, ...p } }));

  const expanded = useMemo(() => expandSessions(draft), [draft]);
  const sessionOptions: SessionOption[] =
    draft.scheduleMode === "multi"
      ? draft.sessions
          .filter((s) => s.date)
          .map((s) => ({ id: s.id, label: formatJalaliDate(`${s.date}T00:00:00.000Z`) }))
      : [];

  const ticketSample: TicketSample = {
    eventTitle: draft.title.trim() || "عنوان رویداد",
    holder: "سارا محمدی",
    category: draft.ticketTypes[0]?.name.trim() || "عمومی",
    seat: "ردیف A · صندلی ۱۲",
    date: expanded[0]?.date
      ? formatJalaliDate(`${expanded[0].date}T00:00:00.000Z`)
      : "تاریخ رویداد",
    venue:
      draft.location.venueName.trim() || draft.location.city.trim() || "مکان رویداد",
  };

  // --- schedule handlers ---
  function setScheduleMode(mode: ScheduleMode) {
    setDraft((d) => ({
      ...d,
      scheduleMode: mode,
      sessions:
        mode === "single" || mode === "recurring"
          ? [d.sessions[0] ?? emptySession("session-1")]
          : d.sessions,
    }));
  }
  const addSession = () =>
    setDraft((d) => ({ ...d, sessions: [...d.sessions, emptySession(crypto.randomUUID())] }));
  const removeSession = (id: string) =>
    setDraft((d) => ({
      ...d,
      sessions: d.sessions.length > 1 ? d.sessions.filter((s) => s.id !== id) : d.sessions,
      ticketTypes: d.ticketTypes.map((t) => ({
        ...t,
        sessionIds: t.sessionIds.filter((sid) => sid !== id),
      })),
    }));
  const sessionChange = (id: string, p: Partial<CreateDraft["sessions"][number]>) =>
    setDraft((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === id ? { ...s, ...p } : s)),
    }));
  const recurrenceChange = (p: Partial<CreateDraft["recurrence"]>) =>
    setDraft((d) => ({ ...d, recurrence: { ...d.recurrence, ...p } }));
  const toggleDay = (day: WeekDay) =>
    setDraft((d) => {
      const has = d.recurrence.byDay.includes(day);
      return {
        ...d,
        recurrence: {
          ...d.recurrence,
          byDay: has
            ? d.recurrence.byDay.filter((x) => x !== day)
            : [...d.recurrence.byDay, day],
        },
      };
    });

  // --- ticket handlers ---
  const addTicket = () =>
    setDraft((d) => ({ ...d, ticketTypes: [...d.ticketTypes, emptyTicket(crypto.randomUUID())] }));
  const updateTicket = (id: string, p: Partial<TicketTypeDraft>) =>
    setDraft((d) => ({
      ...d,
      ticketTypes: d.ticketTypes.map((t) => (t.id === id ? { ...t, ...p } : t)),
    }));
  const removeTicket = (id: string) =>
    setDraft((d) => ({
      ...d,
      ticketTypes:
        d.ticketTypes.length > 1 ? d.ticketTypes.filter((t) => t.id !== id) : d.ticketTypes,
    }));

  // --- submit ---
  async function submit() {
    const errs = validateDraft(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setStatus("error");
      setSubmitError("لطفاً خطاهای مشخص‌شده را برطرف کنید.");
      return;
    }
    setStatus("submitting");
    setSubmitError("");
    try {
      const mode =
        draft.scheduleMode === "recurring"
          ? "recurring"
          : draft.scheduleMode === "multi"
            ? "multi-session"
            : "one-time";
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        mode,
        venue: {
          name: draft.location.venueName.trim() || (draft.location.mode === "online" ? "آنلاین" : ""),
          city: draft.location.city.trim(),
          address: draft.location.address.trim() || draft.location.onlineUrl.trim(),
          capacity: 0,
          ...(draft.location.mode !== "in-person" && draft.location.onlineUrl.trim()
            ? { onlineUrl: draft.location.onlineUrl.trim() }
            : {}),
        },
        sessions: expanded.map((s) => ({
          startAt: iso(s.date, s.startTime),
          endAt: iso(s.date, s.endTime || s.startTime),
        })),
        ...(draft.scheduleMode === "recurring"
          ? {
              recurrence: {
                frequency: draft.recurrence.frequency,
                interval: Math.max(1, Number(draft.recurrence.interval) || 1),
                byDay: draft.recurrence.byDay,
                count: Math.max(1, Number(draft.recurrence.count) || 1),
              },
            }
          : {}),
        tags: [draft.category],
        status: draft.visibility === "public" ? "published" : "draft",
      };

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !("data" in json)) {
        throw new Error(json?.error?.message ?? "خطا در ساخت رویداد.");
      }
      const eventId = json.data.id as string;
      const firstDate = expanded[0]?.date ?? new Date().toISOString().slice(0, 10);
      await Promise.all(
        draft.ticketTypes.map((t) =>
          fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              name: t.name.trim(),
              price: ticketPrice(t),
              capacity: Math.max(0, Math.floor(Number(t.capacity) || 0)),
              salesStartAt: t.salesStart ? iso(t.salesStart, "00:00") : new Date().toISOString(),
              salesEndAt: t.salesEnd ? iso(t.salesEnd, "23:59") : iso(firstDate, "00:00"),
              category: t.kind === "group" ? "group" : "general",
              description: t.description.trim() || undefined,
            }),
          }),
        ),
      );
      setCreatedTitle(draft.title.trim());
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setSubmitError(err instanceof Error ? err.message : "خطای ناشناخته رخ داد.");
    }
  }

  function reset() {
    setDraft(initialDraft);
    setErrors({});
    setStatus("idle");
    setSubmitError("");
    setCreatedTitle("");
    setTemplate(null);
    setStep(0);
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-bold text-foreground">رویداد ساخته شد</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {`«${createdTitle}» با ${draft.ticketTypes.length} نوع بلیت و ${expanded.length} جلسه ثبت شد.`}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset}>
            ساخت رویداد دیگر
          </Button>
          <Link
            href="/events"
            className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            مشاهدهٔ رویدادها
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={STEP_TITLES} current={step} onStep={setStep} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      {/* Form */}
      <div className="flex flex-col gap-6">
        {step === 0 ? (
        <>
        <TemplatePicker
          selected={template}
          onSelect={applyTemplate}
          onBlank={clearTemplate}
        />
        <SectionCard title="مشخصات رویداد">
          <div className="flex flex-col gap-4">
            <Field id="title" label="عنوان" required error={errors.title}>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="مثلاً کنسرت پاییزی"
                aria-invalid={Boolean(errors.title)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Field id="desc" label="توضیحات">
                <Textarea
                  id="desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="دربارهٔ رویداد، برنامه و مخاطبان…"
                />
              </Field>
              <Field id="category" label="دسته">
                <Select
                  id="category"
                  value={draft.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="مکان">
          <div className="flex flex-col gap-4">
            <div className="grid max-w-sm grid-cols-3 gap-2">
              {LOCATION_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={draft.location.mode === m}
                  onClick={() => patchLocation({ mode: m })}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                    draft.location.mode === m
                      ? "border-foreground bg-subtle text-foreground"
                      : "border-border text-muted hover:border-border-strong",
                  )}
                >
                  {LOCATION_LABELS[m]}
                </button>
              ))}
            </div>
            {draft.location.mode !== "online" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="venue" label="نام محل" required error={errors.venueName}>
                  <Input
                    id="venue"
                    value={draft.location.venueName}
                    onChange={(e) => patchLocation({ venueName: e.target.value })}
                    aria-invalid={Boolean(errors.venueName)}
                  />
                </Field>
                <Field id="city" label="شهر" required error={errors.city}>
                  <Input
                    id="city"
                    value={draft.location.city}
                    onChange={(e) => patchLocation({ city: e.target.value })}
                    aria-invalid={Boolean(errors.city)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="address" label="آدرس">
                    <Input
                      id="address"
                      value={draft.location.address}
                      onChange={(e) => patchLocation({ address: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ) : null}
            {draft.location.mode !== "in-person" ? (
              <Field id="online" label="نشانی آنلاین" required error={errors.onlineUrl}>
                <Input
                  id="online"
                  dir="ltr"
                  value={draft.location.onlineUrl}
                  onChange={(e) => patchLocation({ onlineUrl: e.target.value })}
                  placeholder="https://…"
                  aria-invalid={Boolean(errors.onlineUrl)}
                />
              </Field>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="پوستر و رسانه"
          description="یک پوستر و در صورت تمایل گالری تصاویر و ویدیو برای صفحهٔ رویداد."
        >
          <MediaSection
            poster={draft.poster}
            gallery={draft.gallery}
            onPosterChange={(url) => patch({ poster: url })}
            onGalleryChange={(items) => patch({ gallery: items })}
          />
        </SectionCard>
        </>
        ) : null}

        {step === 1 ? (
        <SectionCard
          title="زمان‌بندی"
          description="یک جلسه، مجموعه‌ای تکرارشونده، یا چند سانس با ساعت‌های مختلف."
        >
          <SessionsEditor
            scheduleMode={draft.scheduleMode}
            sessions={draft.sessions}
            recurrence={draft.recurrence}
            generatedCount={expanded.length}
            error={errors.sessions}
            onModeChange={setScheduleMode}
            onSessionChange={sessionChange}
            onAddSession={addSession}
            onRemoveSession={removeSession}
            onRecurrenceChange={recurrenceChange}
            onToggleDay={toggleDay}
          />
        </SectionCard>
        ) : null}

        {step === 2 ? (
        <>
        <SectionCard title="بلیت‌ها" description="هر نوع بلیت با قوانین خودش.">
          <div className="flex flex-col gap-4">
            {errors.tickets ? (
              <p className="text-sm text-danger">{errors.tickets}</p>
            ) : null}
            {draft.ticketTypes.map((t) => (
              <TicketEditor
                key={t.id}
                ticket={t}
                sessions={sessionOptions}
                error={errors[`ticket-${t.id}`]}
                canRemove={draft.ticketTypes.length > 1}
                onChange={(p) => updateTicket(t.id, p)}
                onRemove={() => removeTicket(t.id)}
              />
            ))}
            <button
              type="button"
              onClick={addTicket}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-muted hover:border-border-strong hover:text-foreground"
            >
              <Plus className="size-4" aria-hidden />
              افزودن نوع بلیت
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="طراحی بلیت"
          description="اختیاری — ظاهر بلیت صادرشده را با برند خود هماهنگ کنید."
        >
          <TicketDesignSection
            design={draft.ticketDesign}
            sample={ticketSample}
            onChange={(d) => patch({ ticketDesign: d })}
          />
        </SectionCard>

        <SectionCard title="حریم خصوصی">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {(["public", "unlisted", "private"] as Visibility[]).map((v) => {
                const Icon = VIS_ICON[v];
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={draft.visibility === v}
                    onClick={() => patch({ visibility: v })}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-md border p-3 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/15",
                      draft.visibility === v
                        ? "border-foreground bg-subtle"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <Icon className="size-4 text-foreground" aria-hidden />
                    <span className="text-sm font-medium text-foreground">
                      {VISIBILITY_LABELS[v]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">{VISIBILITY_HINTS[draft.visibility]}</p>

            {draft.visibility === "private" ? (
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-subtle p-4">
                <Field id="accessCode" label="کد دسترسی" error={errors.privacy}>
                  <Input
                    id="accessCode"
                    dir="ltr"
                    value={draft.accessCode}
                    onChange={(e) => patch({ accessCode: e.target.value })}
                    placeholder="مثلاً FRIENDS2026"
                    aria-invalid={Boolean(errors.privacy)}
                  />
                </Field>
                <Toggle
                  label="تأیید ثبت‌نام لازم است"
                  hint="هر درخواست ثبت‌نام پیش از تأیید شما در انتظار می‌ماند."
                  checked={draft.requireApproval}
                  onChange={(v) => patch({ requireApproval: v })}
                />
              </div>
            ) : null}
          </div>
        </SectionCard>
        </>
        ) : null}

        {status === "error" ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{submitError}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={status === "submitting"}>
              <ArrowRight aria-hidden />
              مرحلهٔ قبل
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="lg"
            onClick={goNext}
            disabled={status === "submitting"}
          >
            {step < STEP_TITLES.length - 1 ? (
              <>
                مرحلهٔ بعد
                <ArrowLeft aria-hidden />
              </>
            ) : status === "submitting" ? (
              "در حال ثبت…"
            ) : (
              "ساخت رویداد"
            )}
          </Button>
        </div>
      </div>

      {/* Live preview — collapsible at the top on mobile, sticky sidebar on desktop */}
      <div className="order-first lg:order-1">
        <div className="lg:sticky lg:top-8">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-expanded={showPreview}
            className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-medium text-muted lg:pointer-events-none lg:mb-3"
          >
            پیش‌نمایش
            <ChevronDown
              className={cn(
                "size-4 transition-transform lg:hidden",
                showPreview && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          <div className={cn("lg:block", showPreview ? "block" : "hidden")}>
            <EventPreview draft={draft} sessions={expanded} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
