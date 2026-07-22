/** Approximate centre coordinates + English aliases for major Iranian cities. */
export interface IranCity {
  fa: string;
  en: string[];
  lat: number;
  lng: number;
}

export const IRAN_CITIES: IranCity[] = [
  { fa: "تهران", en: ["tehran"], lat: 35.6892, lng: 51.389 },
  { fa: "اصفهان", en: ["isfahan", "esfahan"], lat: 32.6539, lng: 51.666 },
  { fa: "شیراز", en: ["shiraz"], lat: 29.5918, lng: 52.5837 },
  { fa: "مشهد", en: ["mashhad"], lat: 36.2605, lng: 59.6168 },
  { fa: "تبریز", en: ["tabriz"], lat: 38.08, lng: 46.2919 },
  { fa: "کرج", en: ["karaj"], lat: 35.84, lng: 50.9391 },
  { fa: "اهواز", en: ["ahvaz", "ahwaz"], lat: 31.3183, lng: 48.6706 },
  { fa: "قم", en: ["qom"], lat: 34.6416, lng: 50.8746 },
  { fa: "کرمانشاه", en: ["kermanshah"], lat: 34.3142, lng: 47.065 },
  { fa: "رشت", en: ["rasht"], lat: 37.2808, lng: 49.5832 },
  { fa: "یزد", en: ["yazd"], lat: 31.8974, lng: 54.3569 },
  { fa: "کیش", en: ["kish"], lat: 26.5578, lng: 53.9803 },
];

/** Coordinates for a Persian city name, or null when unknown. */
export function cityCoords(fa: string): { lat: number; lng: number } | null {
  const c = IRAN_CITIES.find((x) => x.fa === fa);
  return c ? { lat: c.lat, lng: c.lng } : null;
}

/** Map an English city name (e.g. from IP geolocation) to its Persian name. */
export function cityFromEnglish(en: string): string | null {
  const q = en.trim().toLowerCase();
  const c = IRAN_CITIES.find((x) => x.en.includes(q));
  return c ? c.fa : null;
}
