import {
  Music,
  GraduationCap,
  Presentation,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  initialDraft,
  emptySlot,
  emptyTicket,
  type CreateDraft,
  type ScheduleDraft,
  type TicketTypeDraft,
} from "./types";

/**
 * A quick-start preset for the composer. `build()` returns a fresh
 * {@link CreateDraft} with newly generated session/ticket ids on each apply.
 */
export interface ComposerTemplate {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  build: () => CreateDraft;
}

function schedule(
  startTime: string,
  endTime: string,
  extra: Partial<ScheduleDraft> = {},
): ScheduleDraft {
  return {
    calendar: false,
    startDate: "",
    endDate: "",
    byDay: [],
    slots: [{ ...emptySlot(crypto.randomUUID()), startTime, endTime }],
    daySlots: {},
    exceptions: [],
    ...extra,
  };
}

function ticket(partial: Partial<TicketTypeDraft>): TicketTypeDraft {
  return { ...emptyTicket(crypto.randomUUID(), partial.kind ?? "paid"), ...partial };
}

export const COMPOSER_TEMPLATES: ComposerTemplate[] = [
  {
    id: "concert",
    name: "کنسرت و اجرای زنده",
    tagline: "یک اجرا با بلیت عادی و ویژه",
    icon: Music,
    build: () => ({
      ...initialDraft,
      category: "موسیقی",
      description:
        "اجرای زندهٔ موسیقی به همراه گروه نوازندگان؛ شبی به‌یادماندنی از موسیقی زنده.",
      location: { ...initialDraft.location, city: "تهران" },
      schedule: schedule("18:30", "21:00"),
      ticketTypes: [
        ticket({ name: "بلیت عادی", kind: "paid" }),
        ticket({ name: "بلیت ویژه (VIP)", kind: "paid" }),
      ],
    }),
  },
  {
    id: "workshop",
    name: "کارگاه و دورهٔ آموزشی",
    tagline: "دورهٔ هفتگی چندجلسه‌ای",
    icon: GraduationCap,
    build: () => ({
      ...initialDraft,
      category: "آموزش",
      description:
        "دورهٔ عملی و کارگاهی با ظرفیت محدود؛ شامل تمرین‌های میدانی و گواهی پایان دوره.",
      location: { ...initialDraft.location, city: "تهران" },
      schedule: schedule("16:00", "19:00", { calendar: true, byDay: ["SA"] }),
      ticketTypes: [
        ticket({ name: "بلیت دوره", kind: "paid" }),
        ticket({ name: "بلیت دانشجویی", kind: "paid" }),
      ],
    }),
  },
  {
    id: "conference",
    name: "همایش و سمینار",
    tagline: "بلیت زودهنگام، حضوری و ویژه",
    icon: Presentation,
    build: () => ({
      ...initialDraft,
      category: "کسب‌وکار",
      description:
        "همایش تخصصی با حضور سخنرانان و کارشناسان؛ به همراه پنل‌های پرسش و پاسخ و شبکه‌سازی.",
      location: { ...initialDraft.location, city: "تهران" },
      schedule: schedule("09:00", "17:00"),
      ticketTypes: [
        ticket({ name: "بلیت زودهنگام", kind: "paid" }),
        ticket({ name: "بلیت حضوری", kind: "paid" }),
        ticket({ name: "بلیت ویژه (VIP)", kind: "paid" }),
      ],
    }),
  },
  {
    id: "meetup",
    name: "رویداد رایگان",
    tagline: "گردهمایی با ثبت‌نام رایگان",
    icon: Users,
    build: () => ({
      ...initialDraft,
      category: "فناوری",
      description:
        "گردهمایی دوستانه و رایگان برای علاقه‌مندان؛ فرصتی برای گفت‌وگو و آشنایی.",
      location: { ...initialDraft.location, city: "تهران" },
      schedule: schedule("17:00", "20:00"),
      ticketTypes: [ticket({ name: "ثبت‌نام رایگان", kind: "free" })],
    }),
  },
];
