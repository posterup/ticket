import type {
  RecurrenceFrequency,
  TicketCategory,
  WeekDay,
} from "@/types";

/** Persian labels for ticket categories (step 3). */
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general: "عمومی",
  vip: "وی‌آی‌پی",
  student: "دانشجویی",
  "early-bird": "زودهنگام",
  backstage: "پشت صحنه",
  group: "گروهی",
};

export const CATEGORY_ORDER: TicketCategory[] = [
  "general",
  "vip",
  "student",
  "early-bird",
  "backstage",
  "group",
];

/** Persian labels for recurrence frequencies (step 2). */
export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "روزانه",
  weekly: "هفتگی",
  monthly: "ماهانه",
  weekday: "روزهای کاری",
};

export const FREQUENCY_ORDER: RecurrenceFrequency[] = [
  "weekly",
  "daily",
  "weekday",
  "monthly",
];

/** Persian labels for week days, ordered Saturday-first (Iranian week). */
export const WEEKDAY_LABELS: Record<WeekDay, string> = {
  SA: "شنبه",
  SU: "یکشنبه",
  MO: "دوشنبه",
  TU: "سه‌شنبه",
  WE: "چهارشنبه",
  TH: "پنجشنبه",
  FR: "جمعه",
};

export const WEEKDAY_ORDER: WeekDay[] = [
  "SA",
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
];
