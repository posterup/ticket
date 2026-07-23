/**
 * Workspace data-access over an in-memory seed. A static event->workspace map
 * stands in for a real `event.workspaceId` foreign key until a datastore is
 * added.
 */

import type { Event, Workspace } from "@/types";

import { listEvents } from "./events";

const workspaces: Workspace[] = [
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

/** slug -> owned event ids (stand-in for event.workspaceId). */
const EVENT_WORKSPACE: Record<string, string[]> = {
  "ava-events": [
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

export function listWorkspaces(): Workspace[] {
  return [...workspaces];
}

export function getWorkspaceBySlug(slug: string): Workspace | undefined {
  return workspaces.find((w) => w.slug === slug);
}

/** Events owned by a workspace (by slug). */
export function listEventsByWorkspace(slug: string): Event[] {
  const ids = new Set(EVENT_WORKSPACE[slug] ?? []);
  return listEvents().filter((e) => ids.has(e.id));
}

/**
 * The workspace that owns a given event. Every event always has an organiser:
 * unmapped events fall back to the first workspace so the public page never
 * shows an event without a manager.
 */
export function getWorkspaceByEvent(eventId: string): Workspace | undefined {
  const slug = Object.keys(EVENT_WORKSPACE).find((s) =>
    EVENT_WORKSPACE[s].includes(eventId),
  );
  return (slug ? getWorkspaceBySlug(slug) : undefined) ?? workspaces[0];
}
