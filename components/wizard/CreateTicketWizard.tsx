"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { TemplatePicker } from "@/components/wizard/TemplatePicker";
import type { EventTemplate } from "@/lib/wizard/templates";
import { StepEventInfo } from "@/components/wizard/StepEventInfo";
import { StepSchedule } from "@/components/wizard/StepSchedule";
import { StepTicketTypes } from "@/components/wizard/StepTicketTypes";
import {
  initialWizardState,
  emptyTicketType,
  type WizardState,
  type WizardMode,
  type EventInfoForm,
  type VenueForm,
  type OneTimeForm,
  type RecurringForm,
  type TicketTypeForm,
} from "@/lib/wizard/types";
import { validateStep, type Errors } from "@/lib/wizard/validation";
import { buildEventPayload, buildTicketPayloads } from "@/lib/wizard/payload";
import type { ApiResponse, Event, WeekDay } from "@/types";

const STEP_TITLES = ["اطلاعات رویداد", "زمان‌بندی", "انواع بلیت"];

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export function CreateTicketWizard() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState("");
  const [createdTitle, setCreatedTitle] = useState("");
  const [template, setTemplate] = useState<string | null>(null);

  // --- templates -----------------------------------------------------------
  const applyTemplate = (t: EventTemplate) => {
    const seeded = t.build();
    // Preserve a title the user may have already typed.
    setState((s) => ({
      ...seeded,
      event: { ...seeded.event, title: s.event.title || seeded.event.title },
    }));
    setErrors({});
    setTemplate(t.id);
  };
  const clearTemplate = () => {
    setState((s) => ({ ...initialWizardState, event: { ...initialWizardState.event, title: s.event.title } }));
    setErrors({});
    setTemplate(null);
  };

  // --- state updates -------------------------------------------------------
  const updateEvent = (patch: Partial<EventInfoForm>) =>
    setState((s) => ({ ...s, event: { ...s.event, ...patch } }));
  const updateVenue = (patch: Partial<VenueForm>) =>
    setState((s) => ({
      ...s,
      event: { ...s.event, venue: { ...s.event.venue, ...patch } },
    }));
  const setMode = (mode: WizardMode) => setState((s) => ({ ...s, mode }));
  const updateOneTime = (patch: Partial<OneTimeForm>) =>
    setState((s) => ({ ...s, oneTime: { ...s.oneTime, ...patch } }));
  const updateRecurring = (patch: Partial<RecurringForm>) =>
    setState((s) => ({ ...s, recurring: { ...s.recurring, ...patch } }));
  const toggleDay = (day: WeekDay) =>
    setState((s) => {
      const has = s.recurring.byDay.includes(day);
      return {
        ...s,
        recurring: {
          ...s.recurring,
          byDay: has
            ? s.recurring.byDay.filter((d) => d !== day)
            : [...s.recurring.byDay, day],
        },
      };
    });
  const addTicket = () =>
    setState((s) => ({
      ...s,
      ticketTypes: [...s.ticketTypes, emptyTicketType(crypto.randomUUID())],
    }));
  const updateTicket = (id: string, patch: Partial<TicketTypeForm>) =>
    setState((s) => ({
      ...s,
      ticketTypes: s.ticketTypes.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    }));
  const removeTicket = (id: string) =>
    setState((s) => ({
      ...s,
      ticketTypes:
        s.ticketTypes.length > 1
          ? s.ticketTypes.filter((t) => t.id !== id)
          : s.ticketTypes,
    }));

  // --- navigation ----------------------------------------------------------
  async function handleSubmit() {
    setStatus("submitting");
    setSubmitError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEventPayload(state)),
      });
      const json = (await res.json()) as ApiResponse<Event>;
      if (!res.ok || !("data" in json)) {
        const message =
          "error" in json ? json.error.message : "خطا در ساخت رویداد.";
        throw new Error(message);
      }
      const eventId = json.data.id;
      await Promise.all(
        buildTicketPayloads(state.ticketTypes, eventId).map((payload) =>
          fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        ),
      );
      setCreatedTitle(state.event.title.trim());
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setSubmitError(
        err instanceof Error ? err.message : "خطای ناشناخته رخ داد.",
      );
    }
  }

  function handleNext() {
    const stepErrors = validateStep(step, state);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    if (step < STEP_TITLES.length - 1) {
      setStep(step + 1);
    } else {
      void handleSubmit();
    }
  }

  function handleBack() {
    setErrors({});
    setStatus("idle");
    setStep((s) => Math.max(0, s - 1));
  }

  function handleReset() {
    setState(initialWizardState);
    setErrors({});
    setStatus("idle");
    setSubmitError("");
    setCreatedTitle("");
    setStep(0);
    setTemplate(null);
  }

  if (status === "success") {
    return <SuccessPanel title={createdTitle} onReset={handleReset} />;
  }

  const isLast = step === STEP_TITLES.length - 1;
  const submitting = status === "submitting";
  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div>
      {step === 0 ? (
        <TemplatePicker
          selected={template}
          onSelect={applyTemplate}
          onBlank={clearTemplate}
        />
      ) : null}

      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <WizardStepper steps={STEP_TITLES} current={step} />

      <div className="mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={transition}
          >
            {step === 0 && (
              <StepEventInfo
                value={state.event}
                errors={errors}
                onChange={updateEvent}
                onVenueChange={updateVenue}
              />
            )}
            {step === 1 && (
              <StepSchedule
                mode={state.mode}
                oneTime={state.oneTime}
                recurring={state.recurring}
                errors={errors}
                onModeChange={setMode}
                onOneTimeChange={updateOneTime}
                onRecurringChange={updateRecurring}
                onToggleDay={toggleDay}
              />
            )}
            {step === 2 && (
              <StepTicketTypes
                ticketTypes={state.ticketTypes}
                errors={errors}
                onAdd={addTicket}
                onUpdate={updateTicket}
                onRemove={removeTicket}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {status === "error" ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={submitting}
          >
            <ArrowRight aria-hidden />
            مرحله قبل
          </Button>
        ) : (
          <span />
        )}

        <Button type="button" onClick={handleNext} disabled={submitting}>
          {isLast
            ? submitting
              ? "در حال ثبت…"
              : "ثبت و ساخت بلیت"
            : "مرحله بعد"}
          {!isLast ? <ArrowLeft aria-hidden /> : null}
        </Button>
      </div>
      </div>
    </div>
  );
}

function SuccessPanel({
  title,
  onReset,
}: {
  title: string;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>
      <h2 className="text-xl font-bold text-foreground">
        رویداد با موفقیت ساخته شد
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {`«${title}» ایجاد شد و انواع بلیت آن ثبت گردید. اکنون می‌توانید رویداد را منتشر کنید یا رویداد دیگری بسازید.`}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" onClick={onReset}>
          ساخت رویداد جدید
        </Button>
        <Link
          href="/"
          className="text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          بازگشت به خانه
        </Link>
      </div>
    </div>
  );
}
