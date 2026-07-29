/**
 * Seed fixtures.
 *
 * The hand-authored dataset the app used to hold in memory, moved here verbatim
 * when `lib/server` moved onto Postgres. It is the seed's own copy on purpose:
 * `lib/server` now reads the database, so importing from it would be circular.
 *
 * Ids are load-bearing — tests and other fixtures reference them by hand, so
 * they must not be renumbered.
 */

import type {
  Attendee,
  Campaign,
  DiscountCode,
  Event,
  EventCollaborator,
  EventGuest,
  EventRegistration,
  TicketType,
  Workspace,
} from "@/types";

export interface EventEngagement {
  going: number;
  interested: number;
}

/** Ownership lives in {@link EVENT_WORKSPACE}, not on the fixture itself. */
export const events: Omit<Event, "workspaceId">[] = [
  {
    id: "3f1a6c2e-0020-4a10-9b21-1a2b3c4d5e20",
    title: "کارگاه رایگان معرفی هوش مصنوعی",
    description:
      "یک نشست مقدماتی و رایگان برای آشنایی با کاربردهای هوش مصنوعی؛ ثبت‌نام رایگان با ظرفیت محدود.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000020",
      name: "مرکز نوآوری دانشگاه تهران",
      city: "تهران",
      address: "تهران، خیابان انقلاب، خیابان دانشگاه، مرکز نوآوری",
      capacity: 60,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000020",
        eventId: "3f1a6c2e-0020-4a10-9b21-1a2b3c4d5e20",
        startAt: "2026-08-05T14:00:00.000Z",
        endAt: "2026-08-05T16:00:00.000Z",
        availability: "available",
      },
    ],
    tags: ["فناوری", "آموزش", "رایگان"],
    categories: ["آموزش", "فناوری"],
    visibility: "public",
    audienceTags: [],
    requiresApproval: false,
    createdAt: "2026-07-26T09:00:00.000Z",
    updatedAt: "2026-07-26T09:00:00.000Z",
  },
  {
    id: "3f1a6c2e-0021-4a10-9b21-1a2b3c4d5e21",
    title: "دورهمی رایگان اعضای انجمن",
    description:
      "گردهمایی دوستانهٔ اعضا؛ ثبت‌نام رایگان و با تأیید مدیر انجام می‌شود.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000021",
      name: "خانهٔ نوآوری اصفهان",
      city: "اصفهان",
      address: "اصفهان، خیابان چهارباغ بالا، خانهٔ نوآوری",
      capacity: 40,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000021",
        eventId: "3f1a6c2e-0021-4a10-9b21-1a2b3c4d5e21",
        startAt: "2026-08-12T15:30:00.000Z",
        endAt: "2026-08-12T18:00:00.000Z",
        availability: "available",
      },
    ],
    tags: ["اجتماعی", "رایگان"],
    categories: ["اجتماعی"],
    visibility: "public",
    audienceTags: [],
    requiresApproval: true,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:00:00.000Z",
  },
  {
    id: "3f1a6c2e-0015-4a10-9b21-1a2b3c4d5e15",
    title: "نشست هفتگی کتاب‌خوانی",
    description:
      "هر سه‌شنبه غروب دور هم جمع می‌شویم، یک کتاب را با هم می‌خوانیم و درباره‌اش گفت‌وگو می‌کنیم؛ رویدادی تقویمی برای دوستداران کتاب.",
    status: "published",
    mode: "recurring",
    venue: {
      id: "b1000000-0000-4000-8000-000000000015",
      name: "کافه‌کتاب نشر ثالث",
      city: "تهران",
      address: "تهران، خیابان کریم‌خان زند، خیابان سنایی، کافه‌کتاب ثالث",
      capacity: 30,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000015",
        eventId: "3f1a6c2e-0015-4a10-9b21-1a2b3c4d5e15",
        startAt: "2026-07-28T15:30:00.000Z",
        endAt: "2026-07-28T17:30:00.000Z",
        availability: "available",
      },
    ],
    recurrence: {
      frequency: "weekly",
      interval: 1,
      byDay: ["TU"],
      count: 12,
    },
    recurrenceSchedule: {
      startDate: "2026-07-28",
      endDate: "2026-10-13",
      byDay: ["TU"],
      slots: [{ id: "rs-0015-1", startTime: "15:30", endTime: "17:30" }],
      exceptions: [],
    },
    tags: ["کتاب", "ادبیات", "گفت‌وگو"],
    categories: ["فرهنگی", "آموزش"],
    createdAt: "2026-07-25T09:00:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z",
  },
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
    categories: ["فرهنگی", "هنر"],
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
    categories: ["مهارت", "هنر"],
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
  {
    id: "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04",
    title: "فستیوال غذای خیابانی اصفهان",
    description:
      "دو روز جشن طعم با غرفه‌های غذای محلی و خیابانی، موسیقی زنده و کارگاه آشپزی در دل اصفهان.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000004",
      name: "باغ غدیر",
      city: "اصفهان",
      address: "اصفهان، خیابان کاوه، بوستان غدیر",
      capacity: 2000,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000005",
        eventId: "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04",
        startAt: "2026-08-28T13:00:00.000Z",
        endAt: "2026-08-28T20:00:00.000Z",
      },
    ],
    tags: ["غذا", "فستیوال", "خانوادگی"],
    categories: ["آشپزی", "گردشگر", "فرهنگی"],
    createdAt: "2026-06-24T10:00:00.000Z",
    updatedAt: "2026-06-24T10:00:00.000Z",
  },
  {
    id: "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05",
    title: "نمایشگاه نقاشی معاصر «رنگ و روایت»",
    description:
      "نمایش آثار هنرمندان جوان نقاشی معاصر ایران، همراه با تور راهنمای گالری و گفت‌وگو با هنرمندان.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000005",
      name: "گالری آران",
      city: "تهران",
      address: "تهران، خیابان نوفل‌لوشاتو، کوچه لولاگر",
      capacity: 150,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000006",
        eventId: "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05",
        startAt: "2026-08-08T14:00:00.000Z",
        endAt: "2026-08-08T20:00:00.000Z",
      },
    ],
    tags: ["هنر", "نمایشگاه", "نقاشی"],
    categories: ["هنر", "خلق"],
    createdAt: "2026-06-25T09:30:00.000Z",
    updatedAt: "2026-06-25T09:30:00.000Z",
  },
  {
    id: "3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06",
    title: "نیمه‌ماراتن شیراز",
    description:
      "دوی همگانی نیمه‌ماراتن در مسیر تاریخی شیراز؛ مناسب دوندگان حرفه‌ای و آماتور با رده‌های سنی مختلف.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000006",
      name: "دروازه قرآن",
      city: "شیراز",
      address: "شیراز، میدان دروازه قرآن",
      capacity: 1500,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000007",
        eventId: "3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06",
        startAt: "2026-09-12T03:30:00.000Z",
        endAt: "2026-09-12T08:00:00.000Z",
      },
    ],
    tags: ["ورزش", "دو", "همگانی"],
    categories: ["هیجان", "گردشگر"],
    createdAt: "2026-06-26T08:00:00.000Z",
    updatedAt: "2026-06-26T08:00:00.000Z",
  },
  {
    id: "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07",
    title: "میتاپ فرانت‌اند تهران",
    description:
      "گردهمایی ماهانهٔ توسعه‌دهندگان فرانت‌اند با ارائه‌های فنی دربارهٔ ری‌اکت، عملکرد و تجربهٔ کاربری.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000007",
      name: "کافه‌بازار - فضای رویداد",
      city: "تهران",
      address: "تهران، خیابان ولیعصر، مجتمع فناوری",
      capacity: 120,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000008",
        eventId: "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07",
        startAt: "2026-08-20T14:30:00.000Z",
        endAt: "2026-08-20T17:30:00.000Z",
      },
    ],
    tags: ["فناوری", "برنامه‌نویسی", "میتاپ"],
    categories: ["مهارت", "گفتگو"],
    createdAt: "2026-06-27T11:15:00.000Z",
    updatedAt: "2026-06-27T11:15:00.000Z",
  },
  // ── Buy-box state samples (today ≈ 2026-07-23) ──────────────────────────
  {
    // State #2 — به‌زودی: sales start in the future.
    id: "3f1a6c2e-0008-4a10-9b21-1a2b3c4d5e08",
    title: "کنسرت ارکستر سمفونیک تهران",
    description:
      "شبی از شکوه موسیقی کلاسیک با اجرای ارکستر سمفونیک تهران و رهبری مهمان بین‌المللی.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000008",
      name: "تالار وحدت",
      city: "تهران",
      address: "تهران، خیابان حافظ، تالار وحدت",
      capacity: 900,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000009",
        eventId: "3f1a6c2e-0008-4a10-9b21-1a2b3c4d5e08",
        startAt: "2026-09-20T18:00:00.000Z",
        endAt: "2026-09-20T20:30:00.000Z",
      },
    ],
    tags: ["موسیقی", "کلاسیک", "کنسرت"],
    categories: ["فرهنگی", "هنر"],
    createdAt: "2026-07-18T09:00:00.000Z",
    updatedAt: "2026-07-18T09:00:00.000Z",
  },
  {
    // State #3 — فروش زودهنگام: an early-bird ticket priced below the regular.
    id: "3f1a6c2e-0009-4a10-9b21-1a2b3c4d5e09",
    title: "جشنواره موسیقی الکترونیک کیش",
    description:
      "دو شب موسیقی الکترونیک با دی‌جی‌های مطرح داخلی و خارجی در جزیره کیش.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000009",
      name: "آمفی‌تئاتر ساحلی کیش",
      city: "کیش",
      address: "جزیره کیش، پارک ساحلی مرجان",
      capacity: 800,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000010",
        eventId: "3f1a6c2e-0009-4a10-9b21-1a2b3c4d5e09",
        startAt: "2026-10-10T17:30:00.000Z",
        endAt: "2026-10-10T23:00:00.000Z",
      },
    ],
    tags: ["موسیقی", "الکترونیک", "فستیوال"],
    categories: ["هیجان", "هنر"],
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
  },
  {
    // State #4 — ثبت‌نام با تأیید: requires organiser approval.
    id: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
    title: "کارگاه خصوصی مدیریت برند",
    description:
      "کارگاه فشرده و محدود مدیریت برند برای مدیران بازاریابی؛ پذیرش پس از بررسی درخواست.",
    status: "published",
    mode: "one-time",
    requiresApproval: true,
    venue: {
      id: "b1000000-0000-4000-8000-000000000010",
      name: "هتل اسپیناس پالاس",
      city: "تهران",
      address: "تهران، سعادت‌آباد، بلوار پاک‌نژاد",
      capacity: 30,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000011",
        eventId: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
        startAt: "2026-09-01T05:30:00.000Z",
        endAt: "2026-09-01T12:30:00.000Z",
      },
    ],
    tags: ["کارگاه", "بازاریابی", "برند"],
    categories: ["مهارت", "خلق"],
    createdAt: "2026-07-20T08:30:00.000Z",
    updatedAt: "2026-07-20T08:30:00.000Z",
  },
  {
    // State #5 — رو به اتمام: low remaining stock (sold 112 / 120).
    id: "3f1a6c2e-0011-4a10-9b21-1a2b3c4d5e11",
    title: "استندآپ کمدی شب‌های تهران",
    description:
      "یک شب پر از خنده با اجرای زندهٔ کمدین‌های محبوب استندآپ ایران.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000011",
      name: "پردیس تئاتر شهرزاد",
      city: "تهران",
      address: "تهران، خیابان کریم‌خان زند، خیابان شهید عضدی",
      capacity: 120,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000012",
        eventId: "3f1a6c2e-0011-4a10-9b21-1a2b3c4d5e11",
        startAt: "2026-08-05T18:30:00.000Z",
        endAt: "2026-08-05T20:30:00.000Z",
      },
    ],
    tags: ["کمدی", "استندآپ", "نمایش"],
    categories: ["هیجان", "گفتگو"],
    createdAt: "2026-07-21T11:00:00.000Z",
    updatedAt: "2026-07-21T11:00:00.000Z",
  },
  {
    // State #7 — تمام‌شده + لیست انتظار: stock exhausted, waitlist enabled.
    id: "3f1a6c2e-0012-4a10-9b21-1a2b3c4d5e12",
    title: "نمایش تئاتر «پردهٔ آخر»",
    description:
      "نمایشی تأثیرگذار دربارهٔ خانواده و فراموشی؛ کاری از گروه تئاتر مستقل نو.",
    status: "published",
    mode: "one-time",
    waitlist: true,
    venue: {
      id: "b1000000-0000-4000-8000-000000000012",
      name: "تئاتر شهر - سالن اصلی",
      city: "تهران",
      address: "تهران، خیابان انقلاب، چهارراه ولیعصر، تئاتر شهر",
      capacity: 200,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000013",
        eventId: "3f1a6c2e-0012-4a10-9b21-1a2b3c4d5e12",
        startAt: "2026-08-18T19:00:00.000Z",
        endAt: "2026-08-18T21:00:00.000Z",
      },
    ],
    tags: ["تئاتر", "نمایش", "درام"],
    categories: ["هنر", "فرهنگی"],
    createdAt: "2026-07-15T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
  },
  {
    // State #8 — تمام‌شده بدون لیست انتظار: sales window already ended.
    id: "3f1a6c2e-0013-4a10-9b21-1a2b3c4d5e13",
    title: "شب شعر و موسیقی «مهتاب»",
    description:
      "شبی از شعر معاصر و موسیقی زنده در فضایی صمیمی؛ فروش بلیت این برنامه به پایان رسیده است.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000013",
      name: "فرهنگسرای نیاوران",
      city: "تهران",
      address: "تهران، نیاوران، جمال‌آباد، فرهنگسرای نیاوران",
      capacity: 500,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000014",
        eventId: "3f1a6c2e-0013-4a10-9b21-1a2b3c4d5e13",
        startAt: "2026-08-02T17:30:00.000Z",
        endAt: "2026-08-02T20:00:00.000Z",
      },
    ],
    tags: ["شعر", "موسیقی", "ادبیات"],
    categories: ["فرهنگی", "گفتگو", "هنر"],
    createdAt: "2026-06-28T09:00:00.000Z",
    updatedAt: "2026-07-21T09:00:00.000Z",
  },
  {
    // Normal on-sale; populates the «بازی» category.
    id: "3f1a6c2e-0014-4a10-9b21-1a2b3c4d5e14",
    title: "شب بازی‌های رومیزی",
    description:
      "شبی پر از هیجان با دورهمیِ بازی‌های رومیزی و کارت؛ از مبتدی تا حرفه‌ای، همراه با پذیرایی.",
    status: "published",
    mode: "one-time",
    venue: {
      id: "b1000000-0000-4000-8000-000000000014",
      name: "کافه بردگیم آسمان",
      city: "تهران",
      address: "تهران، خیابان شریعتی، بالاتر از حسینیه ارشاد",
      capacity: 60,
    },
    sessions: [
      {
        id: "c1000000-0000-4000-8000-000000000016",
        eventId: "3f1a6c2e-0014-4a10-9b21-1a2b3c4d5e14",
        startAt: "2026-08-08T15:30:00.000Z",
        endAt: "2026-08-08T19:30:00.000Z",
      },
    ],
    tags: ["بازی", "دورهمی", "سرگرمی"],
    categories: ["بازی", "گفتگو"],
    createdAt: "2026-07-22T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
  },
];

export const ticketTypes: TicketType[] = [
  {
    id: "d1000000-0000-4000-8000-000000000020",
    eventId: "3f1a6c2e-0020-4a10-9b21-1a2b3c4d5e20",
    name: "بلیت رایگان",
    price: 0,
    capacity: 60,
    salesStartAt: "2026-07-26T00:00:00.000Z",
    salesEndAt: "2026-08-05T14:00:00.000Z",
    category: "general",
    description: "ثبت‌نام رایگان کارگاه؛ ظرفیت محدود.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000021",
    eventId: "3f1a6c2e-0021-4a10-9b21-1a2b3c4d5e21",
    name: "بلیت رایگان",
    price: 0,
    capacity: 40,
    salesStartAt: "2026-07-26T00:00:00.000Z",
    salesEndAt: "2026-08-12T15:30:00.000Z",
    category: "general",
    description: "ثبت‌نام رایگان دورهمی؛ نیازمند تأیید مدیر.",
  },
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
  {
    id: "d1000000-0000-4000-8000-000000000004",
    eventId: "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04",
    name: "بلیت ورود",
    price: 350_000,
    capacity: 2000,
    salesStartAt: "2026-07-01T00:00:00.000Z",
    salesEndAt: "2026-08-28T10:00:00.000Z",
    category: "general",
    description: "ورود به فستیوال به همراه یک ژتون غذا.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000005",
    eventId: "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05",
    name: "بلیت بازدید",
    price: 150_000,
    capacity: 150,
    salesStartAt: "2026-07-05T00:00:00.000Z",
    salesEndAt: "2026-08-08T12:00:00.000Z",
    category: "general",
    description: "بازدید از نمایشگاه به همراه تور راهنما.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000006",
    eventId: "3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06",
    name: "ثبت‌نام دوندگان",
    price: 480_000,
    capacity: 1500,
    salesStartAt: "2026-07-10T00:00:00.000Z",
    salesEndAt: "2026-09-10T00:00:00.000Z",
    category: "general",
    description: "شامل شماره دونده، تی‌شرت و مدال پایان مسیر.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000007",
    eventId: "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07",
    name: "ثبت‌نام رایگان",
    price: 0,
    capacity: 120,
    salesStartAt: "2026-07-15T00:00:00.000Z",
    salesEndAt: "2026-08-20T12:00:00.000Z",
    category: "general",
    description: "حضور رایگان با ثبت‌نام قبلی.",
  },
  // ── Tickets for the buy-box state samples ───────────────────────────────
  {
    // #2 به‌زودی — sales start 2026-08-01 (future).
    id: "d1000000-0000-4000-8000-000000000008",
    eventId: "3f1a6c2e-0008-4a10-9b21-1a2b3c4d5e08",
    name: "بلیت عادی",
    price: 1_500_000,
    capacity: 900,
    salesStartAt: "2026-08-01T00:00:00.000Z",
    salesEndAt: "2026-09-19T18:00:00.000Z",
    category: "general",
    description: "دسترسی به سالن اصلی تالار وحدت.",
  },
  {
    // #3 فروش زودهنگام — early-bird active now, below the regular price.
    id: "d1000000-0000-4000-8000-000000000009",
    eventId: "3f1a6c2e-0009-4a10-9b21-1a2b3c4d5e09",
    name: "بلیت زودهنگام",
    price: 1_200_000,
    capacity: 200,
    sold: 60,
    salesStartAt: "2026-07-01T00:00:00.000Z",
    salesEndAt: "2026-08-15T00:00:00.000Z",
    category: "early-bird",
    description: "قیمت ویژه برای خریدهای زودهنگام.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000010",
    eventId: "3f1a6c2e-0009-4a10-9b21-1a2b3c4d5e09",
    name: "بلیت عادی",
    price: 1_800_000,
    capacity: 600,
    salesStartAt: "2026-07-01T00:00:00.000Z",
    salesEndAt: "2026-10-09T17:30:00.000Z",
    category: "general",
    description: "بلیت ورود عمومی به فستیوال.",
  },
  {
    // #4 ثبت‌نام با تأیید — the event carries requiresApproval.
    id: "d1000000-0000-4000-8000-000000000011",
    eventId: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
    name: "بلیت کارگاه",
    price: 3_000_000,
    capacity: 30,
    salesStartAt: "2026-07-10T00:00:00.000Z",
    salesEndAt: "2026-08-30T00:00:00.000Z",
    category: "general",
    description: "پذیرش پس از تأیید میزبان.",
  },
  {
    // #5 رو به اتمام — sold 112 of 120 (≈7% remaining).
    id: "d1000000-0000-4000-8000-000000000012",
    eventId: "3f1a6c2e-0011-4a10-9b21-1a2b3c4d5e11",
    name: "بلیت ورود",
    price: 850_000,
    capacity: 120,
    sold: 112,
    salesStartAt: "2026-07-01T00:00:00.000Z",
    salesEndAt: "2026-08-04T18:30:00.000Z",
    category: "general",
    description: "صندلی‌های محدود باقی‌مانده.",
  },
  {
    // #7 تمام‌شده + لیست انتظار — sold out (200/200), event.waitlist = true.
    id: "d1000000-0000-4000-8000-000000000013",
    eventId: "3f1a6c2e-0012-4a10-9b21-1a2b3c4d5e12",
    name: "بلیت نمایش",
    price: 600_000,
    capacity: 200,
    sold: 200,
    salesStartAt: "2026-07-01T00:00:00.000Z",
    salesEndAt: "2026-08-17T19:00:00.000Z",
    category: "general",
    description: "تمام صندلی‌ها فروخته شده است.",
  },
  {
    // #8 تمام‌شده بدون لیست انتظار — sales window ended 2026-07-20.
    id: "d1000000-0000-4000-8000-000000000014",
    eventId: "3f1a6c2e-0013-4a10-9b21-1a2b3c4d5e13",
    name: "بلیت ورود",
    price: 1_100_000,
    capacity: 500,
    sold: 300,
    salesStartAt: "2026-06-01T00:00:00.000Z",
    salesEndAt: "2026-07-20T00:00:00.000Z",
    category: "general",
    description: "مهلت فروش این بلیت به پایان رسیده است.",
  },
  {
    id: "d1000000-0000-4000-8000-000000000015",
    eventId: "3f1a6c2e-0014-4a10-9b21-1a2b3c4d5e14",
    name: "بلیت ورود",
    price: 250_000,
    capacity: 60,
    salesStartAt: "2026-07-05T00:00:00.000Z",
    salesEndAt: "2026-08-08T15:30:00.000Z",
    category: "general",
    description: "شامل یک نوشیدنی و دسترسی به همهٔ بازی‌ها.",
  },
];

export const attendees: Attendee[] = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    fullName: "سارا محمدی",
    phone: "+989121234567",
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
    tags: [{ id: "t3", label: "برگزارکننده", color: "violet" }],
    notes: "مدیر برنامه در چند رویداد استارتاپی.",
    customFields: [{ key: "role", label: "نقش", value: "مدیر محصول" }],
    createdAt: "2026-06-12T09:45:00.000Z",
  },
];

export const eventGuests: EventGuest[] = [
  {
    id: "g1000000-0000-4000-8000-000000000001",
    eventId: "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    sessionId: "c1000000-0000-4000-8000-000000000001",
    contact: "+989121110000",
    channel: "phone",
    status: "going",
    createdAt: "2026-07-01T10:00:00.000Z",
  },
];

export const eventRegistrations: EventRegistration[] = [
  {
    id: "r1000000-0000-4000-8000-000000000001",
    eventId: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
    name: "نگار حسینی",
    phone: "09121234567",
    tickets: 2,
    status: "pending",
    createdAt: "2026-07-22T09:15:00.000Z",
  },
  {
    id: "r1000000-0000-4000-8000-000000000002",
    eventId: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
    name: "امیر رضایی",
    phone: "09122345678",
    tickets: 1,
    status: "pending",
    createdAt: "2026-07-22T11:40:00.000Z",
  },
  {
    id: "r1000000-0000-4000-8000-000000000003",
    eventId: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
    name: "سمیرا کاظمی",
    phone: "09357654321",
    tickets: 4,
    status: "pending",
    createdAt: "2026-07-23T08:05:00.000Z",
  },
  {
    id: "r1000000-0000-4000-8000-000000000004",
    eventId: "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
    name: "پویا مرادی",
    phone: "09301112233",
    tickets: 2,
    status: "accepted",
    createdAt: "2026-07-21T14:20:00.000Z",
  },
];

export const eventCollaborators: EventCollaborator[] = [
  {
    id: "cb100000-0000-4000-8000-000000000001",
    eventId: "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    channel: "workspace",
    label: "استودیو رویداد آوا",
    sub: "@ava-events",
    workspaceSlug: "ava-events",
    avatar: "آ",
    status: "accepted",
    createdAt: "2026-07-02T12:00:00.000Z",
  },
];

export const workspaces: Workspace[] = [
  {
    id: "w1000000-0000-4000-8000-000000000001",
    slug: "ava-events",
    name: "استودیو رویداد آوا",
    type: "business",
    bio: "برگزارکنندهٔ کنسرت‌ها و همایش‌های فرهنگی و فناوری در تهران.",
    avatar: "آ",
    followers: 12480,
    following: 86,
    verified: true,
    createdAt: "2025-11-02T09:00:00.000Z",
  },
  {
    id: "w1000000-0000-4000-8000-000000000002",
    slug: "negar-karimi",
    name: "نگار کریمی",
    type: "personal",
    bio: "عکاس و مدرس عکاسی خیابانی.",
    avatar: "ن",
    followers: 3120,
    following: 145,
    createdAt: "2026-01-18T12:30:00.000Z",
  },
  {
    id: "w1000000-0000-4000-8000-000000000003",
    slug: "chef-collective",
    name: "کلکسیون سرآشپز",
    type: "business",
    bio: "برگزارکنندهٔ فستیوال‌ها و رویدادهای غذا و آشپزی در سراسر ایران.",
    avatar: "س",
    followers: 5860,
    following: 42,
    verified: true,
    createdAt: "2025-12-09T08:00:00.000Z",
  },
  {
    id: "w1000000-0000-4000-8000-000000000004",
    slug: "iran-runners",
    name: "باشگاه دوندگان ایران",
    type: "business",
    bio: "برگزاری دوهای همگانی و ماراتن در شهرهای مختلف کشور.",
    avatar: "د",
    followers: 7340,
    following: 58,
    verified: true,
    createdAt: "2025-10-21T07:30:00.000Z",
  },
];

export const EVENT_WORKSPACE: Record<string, string[]> = {
  "ava-events": [
    "3f1a6c2e-0015-4a10-9b21-1a2b3c4d5e15",
    "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01",
    "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03",
    "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05",
    "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07",
    "3f1a6c2e-0008-4a10-9b21-1a2b3c4d5e08",
    "3f1a6c2e-0009-4a10-9b21-1a2b3c4d5e09",
    "3f1a6c2e-0011-4a10-9b21-1a2b3c4d5e11",
    "3f1a6c2e-0012-4a10-9b21-1a2b3c4d5e12",
    "3f1a6c2e-0013-4a10-9b21-1a2b3c4d5e13",
  ],
  "negar-karimi": [
    "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02",
    "3f1a6c2e-0010-4a10-9b21-1a2b3c4d5e10",
  ],
  "chef-collective": [
    "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04",
    "3f1a6c2e-0014-4a10-9b21-1a2b3c4d5e14",
  ],
  "iran-runners": ["3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06"],
};

const CONCERT_EVENT = "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01";

export const discounts: DiscountCode[] = [
  {
    id: "dc100000-0000-4000-8000-000000000001",
    eventId: null,
    code: "WELCOME10",
    kind: "percent",
    value: 10,
    maxRedemptions: 100,
    redemptions: 23,
    expiresAt: null,
    active: true,
    createdAt: "2026-06-15T09:00:00.000Z",
  },
  {
    id: "dc100000-0000-4000-8000-000000000002",
    eventId: CONCERT_EVENT,
    code: "EARLY",
    kind: "fixed",
    value: 500_000,
    maxRedemptions: 200,
    redemptions: 148,
    expiresAt: "2026-08-01T20:30:00.000Z",
    active: true,
    createdAt: "2026-06-16T10:30:00.000Z",
  },
  {
    id: "dc100000-0000-4000-8000-000000000003",
    eventId: CONCERT_EVENT,
    code: "VIP20",
    kind: "percent",
    value: 20,
    maxRedemptions: 50,
    redemptions: 50,
    expiresAt: null,
    active: true,
    createdAt: "2026-06-18T12:00:00.000Z",
  },
];

export const campaigns: Campaign[] = [
  {
    id: "cmp10000-0000-4000-8000-000000000001",
    name: "یادآوری کنسرت همایون شجریان",
    channel: "sms",
    segment: "همه مخاطبان",
    status: "sent",
    recipients: 3,
    message: "کنسرت همایون شجریان، ۲۳ مرداد در برج میلاد. بلیت‌ها رو به اتمام است.",
    sentAt: "2026-07-15T10:00:00.000Z",
  },
  {
    id: "cmp10000-0000-4000-8000-000000000002",
    name: "تخفیف زودهنگام همایش استارتاپی",
    channel: "sms",
    segment: "برگزارکننده",
    status: "sent",
    recipients: 1,
    message: "با کد EARLY تا پایان هفته از تخفیف بلیت زودهنگام بهره‌مند شوید.",
    sentAt: "2026-07-10T08:30:00.000Z",
  },
];

export const ENGAGEMENT: Record<string, EventEngagement> = {
  "3f1a6c2e-0001-4a10-9b21-1a2b3c4d5e01": { going: 842, interested: 1360 },
  "3f1a6c2e-0002-4a10-9b21-1a2b3c4d5e02": { going: 26, interested: 74 },
  "3f1a6c2e-0003-4a10-9b21-1a2b3c4d5e03": { going: 118, interested: 240 },
  "3f1a6c2e-0004-4a10-9b21-1a2b3c4d5e04": { going: 510, interested: 930 },
  "3f1a6c2e-0005-4a10-9b21-1a2b3c4d5e05": { going: 64, interested: 152 },
  "3f1a6c2e-0006-4a10-9b21-1a2b3c4d5e06": { going: 388, interested: 605 },
  "3f1a6c2e-0007-4a10-9b21-1a2b3c4d5e07": { going: 72, interested: 133 },
};
