import {
  Music,
  GraduationCap,
  Presentation,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  initialWizardState,
  emptyTicketType,
  type WizardState,
  type TicketTypeForm,
} from "./types";

/**
 * A reusable event preset. `build()` returns a fresh {@link WizardState} with
 * newly generated ticket ids each time, so applying a template never shares
 * mutable references with a previous application.
 */
export interface EventTemplate {
  id: string;
  name: string;
  /** One-line description shown on the picker card. */
  tagline: string;
  icon: LucideIcon;
  build: () => WizardState;
}

/** A ticket-type form pre-filled from a partial, with a fresh id. */
function ticket(partial: Partial<TicketTypeForm>): TicketTypeForm {
  return { ...emptyTicketType(crypto.randomUUID()), ...partial };
}

/** Ordered list of built-in templates offered at the top of the wizard. */
export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "concert",
    name: "کنسرت و اجرای زنده",
    tagline: "بلیت عادی و ویژه برای یک اجرای مشخص",
    icon: Music,
    build: () => ({
      ...initialWizardState,
      event: {
        title: "",
        description:
          "اجرای زندهٔ موسیقی به همراه گروه نوازندگان؛ شبی به‌یادماندنی از موسیقی زنده.",
        venue: { name: "", city: "تهران", address: "", capacity: "" },
      },
      mode: "one-time",
      oneTime: { date: "", startTime: "18:30", endTime: "21:00" },
      ticketTypes: [
        ticket({ name: "بلیت عادی", category: "general", capacity: "500" }),
        ticket({ name: "بلیت ویژه (VIP)", category: "vip", capacity: "100" }),
      ],
    }),
  },
  {
    id: "workshop",
    name: "کارگاه و دورهٔ آموزشی",
    tagline: "دورهٔ هفتگی با بلیت عادی و دانشجویی",
    icon: GraduationCap,
    build: () => ({
      ...initialWizardState,
      event: {
        title: "",
        description:
          "دورهٔ عملی و کارگاهی با ظرفیت محدود؛ شامل تمرین‌های میدانی و ارائهٔ گواهی پایان دوره.",
        venue: { name: "", city: "تهران", address: "", capacity: "" },
      },
      mode: "recurring",
      recurring: {
        frequency: "weekly",
        interval: "1",
        byDay: ["SA"],
        date: "",
        startTime: "16:00",
        endTime: "19:00",
        until: "",
      },
      ticketTypes: [
        ticket({ name: "بلیت دوره", category: "general", capacity: "30" }),
        ticket({ name: "بلیت دانشجویی", category: "student", capacity: "15" }),
      ],
    }),
  },
  {
    id: "conference",
    name: "همایش و سمینار",
    tagline: "بلیت زودهنگام، حضوری و ویژه",
    icon: Presentation,
    build: () => ({
      ...initialWizardState,
      event: {
        title: "",
        description:
          "همایش تخصصی با حضور سخنرانان و کارشناسان؛ به همراه پنل‌های پرسش و پاسخ و شبکه‌سازی.",
        venue: { name: "", city: "تهران", address: "", capacity: "" },
      },
      mode: "one-time",
      oneTime: { date: "", startTime: "09:00", endTime: "17:00" },
      ticketTypes: [
        ticket({ name: "بلیت زودهنگام", category: "early-bird", capacity: "150" }),
        ticket({ name: "بلیت حضوری", category: "general", capacity: "300" }),
        ticket({ name: "بلیت ویژه (VIP)", category: "vip", capacity: "50" }),
      ],
    }),
  },
  {
    id: "meetup",
    name: "رویداد رایگان",
    tagline: "گردهمایی با ثبت‌نام رایگان",
    icon: Users,
    build: () => ({
      ...initialWizardState,
      event: {
        title: "",
        description:
          "گردهمایی دوستانه و رایگان برای علاقه‌مندان؛ فرصتی برای گفت‌وگو و آشنایی.",
        venue: { name: "", city: "تهران", address: "", capacity: "" },
      },
      mode: "one-time",
      oneTime: { date: "", startTime: "17:00", endTime: "20:00" },
      ticketTypes: [
        ticket({ name: "ثبت‌نام رایگان", category: "general", price: "0", capacity: "100" }),
      ],
    }),
  },
];
