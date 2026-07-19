/**
 * In-memory mock datastore.
 *
 * ⚠️ This module holds seed data in plain module-level arrays and mutates them
 * in place. It exists so the API and UI can be developed end-to-end without a
 * database. Replace it with a real datastore (Postgres/Prisma, Drizzle, …)
 * before production — the exported arrays are the only stateful surface.
 */

import type { Attendee, Event, TicketType } from "@/types";

/** Seed events: real Tehran venues and Persian titles. */
export const events: Event[] = [
  {
    id: "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    title: "کنسرت همایون شجریان",
    description:
      "اجرای زنده آلبوم «ایران من» با ارکستر ملی، شبی به‌یادماندنی از موسیقی اصیل ایرانی.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000001",
      name: "برج میلاد - سالن همایش‌ها",
      city: "تهران",
      address: "تهران، بزرگراه شیخ فضل‌الله نوری، برج میلاد",
      capacity: 1800,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000001",
        eventId: "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
        startAt: "2026-08-14T18:30:00.000Z",
        endAt: "2026-08-14T21:00:00.000Z",
      },
    ],
    tags: ["موسیقی", "کنسرت", "سنتی"],
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-20T12:30:00.000Z",
  },
  {
    id: "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02",
    title: "کارگاه هفتگی عکاسی خیابانی",
    description:
      "دوره عملی عکاسی خیابانی به همراه خروجی‌های میدانی در محله‌های قدیمی تهران.",
    status: "published",
    mode: "recurring",
    venue: {
      id: "b1000000-0000-4000-8000-000000000002",
      name: "خانه هنرمندان ایران",
      city: "تهران",
      address: "تهران، خیابان طالقانی، خیابان شهید موسوی شمالی، باغ هنر",
      capacity: 40,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000002",
        eventId: "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02",
        startAt: "2026-07-25T13:00:00.000Z",
        endAt: "2026-07-25T16:00:00.000Z",
      },
    ],
    recurrence: {
      frequency: "weekly",
      interval: 1,
      byDay: ["SA"],
      count: 8,
    },
    tags: ["کارگاه", "عکاسی", "آموزش"],
    createdAt: "2026-06-10T08:15:00.000Z",
    updatedAt: "2026-06-18T10:00:00.000Z",
  },
  {
    id: "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03",
    title: "همایش استارتاپی نقشه راه محصول",
    description:
      "رویداد دو نشسته‌ای مدیریت محصول با حضور بنیان‌گذاران و مدیران محصول اکوسیستم فناوری ایران.",
    status: "draft",
    mode: "multi-session",
    venue: {
      id: "b1000000-0000-4000-8000-000000000003",
      name: "مرکز نوآوری پردیس",
      city: "تهران",
      address: "تهران، پارک فناوری پردیس، ساختمان نوآوری",
      capacity: 300,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000003",
        eventId: "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03",
        startAt: "2026-09-05T05:30:00.000Z",
        endAt: "2026-09-05T09:30:00.000Z",
      },
      {
        id: "c1000000-0000-4000-8000-000000000004",
        eventId: "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03",
        startAt: "2026-09-05T11:00:00.000Z",
        endAt: "2026-09-05T14:00:00.000Z",
      },
    ],
    tags: ["استارتاپ", "مدیریت محصول", "همایش"],
    createdAt: "2026-06-22T14:45:00.000Z",
    updatedAt: "2026-06-22T14:45:00.000Z",
  },
];

/** Seed ticket types spread across the seed events. */
export const ticketTypes: TicketType[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    eventId: "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    name: "بلیت عادی",
    price: 2_800_000,
    capacity: 1200,
    salesStartAt: "2026-06-15T00:00:00.000Z",
    salesEndAt: "2026-08-14T15:00:00.000Z",
    category: "general",
    description: "دسترسی به ردیف‌های میانی و بالای سالن.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000002",
    eventId: "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    name: "بلیت ویژه (VIP)",
    price: 5_500_000,
    capacity: 300,
    salesStartAt: "2026-06-15T00:00:00.000Z",
    salesEndAt: "2026-08-14T15:00:00.000Z",
    category: "vip",
    description: "ردیف‌های نزدیک صحنه به همراه پذیرایی.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000003",
    eventId: "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02",
    name: "بلیت دانشجویی",
    price: 900_000,
    capacity: 15,
    salesStartAt: "2026-06-20T00:00:00.000Z",
    salesEndAt: "2026-07-24T20:00:00.000Z",
    category: "student",
    description: "با ارائه کارت دانشجویی معتبر.",
  },
];

/** Seed CRM contacts with realistic Persian names. */
export const attendees: Attendee[] = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    fullName: "سارا محمدی",
    phone: "+989121234567",
    email: "sara.mohammadi@example.com",
    tags: [{ id: "t1", label: "مشتری وفادار", color: "emerald" }],
    notes: "علاقه‌مند به رویدادهای موسیقی سنتی.",
    customFields: [{ key: "company", label: "سازمان", value: "شرکت آوای هنر" }],
    createdAt: "2026-05-30T11:00:00.000Z",
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    fullName: "امیرحسین رضایی",
    phone: "+989351112233",
    tags: [{ id: "t2", label: "دانشجو", color: "sky" }],
    customFields: [],
    createdAt: "2026-06-05T16:20:00.000Z",
  },
  {
    id: "e1000000-0000-4000-8000-000000000003",
    fullName: "نگار کریمی",
    phone: "+989901234501",
    email: "negar.karimi@example.com",
    tags: [{ id: "t3", label: "برگزارکننده", color: "violet" }],
    notes: "مدیر برنامه در چند رویداد استارتاپی.",
    customFields: [{ key: "role", label: "نقش", value: "مدیر محصول" }],
    createdAt: "2026-06-12T09:45:00.000Z",
  },
];
