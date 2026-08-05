import { describe, it, expect } from "vitest";

import * as M from "@/lib/server/mappers/enums";

/**
 * The domain unions in `types/` and the Prisma enums are two spellings of the
 * same thing. The `Record<DomainUnion, PrismaEnum>` declarations already make a
 * missing key a compile error; these assert the runtime inverses stay in step,
 * which the type system cannot see.
 */
type EnumPair = readonly [
  name: string,
  toDb: Record<string, string>,
  fromDb: Record<string, string>,
];

const PAIRS: readonly EnumPair[] = [
  ["EventStatus", M.EVENT_STATUS_TO_DB, M.EVENT_STATUS_FROM_DB],
  ["EventVisibility", M.EVENT_VISIBILITY_TO_DB, M.EVENT_VISIBILITY_FROM_DB],
  ["EventMode", M.EVENT_MODE_TO_DB, M.EVENT_MODE_FROM_DB],
  [
    "SessionAvailability",
    M.SESSION_AVAILABILITY_TO_DB,
    M.SESSION_AVAILABILITY_FROM_DB,
  ],
  ["TicketCategory", M.TICKET_CATEGORY_TO_DB, M.TICKET_CATEGORY_FROM_DB],
  ["TicketStatus", M.TICKET_STATUS_TO_DB, M.TICKET_STATUS_FROM_DB],
  ["DiscountKind", M.DISCOUNT_KIND_TO_DB, M.DISCOUNT_KIND_FROM_DB],
  ["GuestRsvp", M.GUEST_RSVP_TO_DB, M.GUEST_RSVP_FROM_DB],
  [
    "RegistrationStatus",
    M.REGISTRATION_STATUS_TO_DB,
    M.REGISTRATION_STATUS_FROM_DB,
  ],
  [
    "CollaboratorChannel",
    M.COLLABORATOR_CHANNEL_TO_DB,
    M.COLLABORATOR_CHANNEL_FROM_DB,
  ],
  [
    "CollaboratorStatus",
    M.COLLABORATOR_STATUS_TO_DB,
    M.COLLABORATOR_STATUS_FROM_DB,
  ],
  ["WorkspaceRole", M.WORKSPACE_ROLE_TO_DB, M.WORKSPACE_ROLE_FROM_DB],
  ["EventCollabRole", M.COLLAB_ROLE_TO_DB, M.COLLAB_ROLE_FROM_DB],
];

describe.each(PAIRS)("%s enum mapping", (_name, toDb, fromDb) => {
  it("round-trips every domain value", () => {
    for (const domain of Object.keys(toDb)) {
      expect(fromDb[toDb[domain]]).toBe(domain);
    }
  });

  it("is a bijection — no two domain values share a column value", () => {
    const columnValues = Object.values(toDb);
    expect(new Set(columnValues).size).toBe(columnValues.length);
    expect(Object.keys(fromDb)).toHaveLength(Object.keys(toDb).length);
  });
});

describe("hyphenated domain values", () => {
  it("keeps the wire spelling the API already returns", () => {
    // These are the ones Prisma could not name directly.
    expect(M.EVENT_MODE_TO_DB["one-time"]).toBe("ONE_TIME");
    expect(M.EVENT_MODE_TO_DB["multi-session"]).toBe("MULTI_SESSION");
    expect(M.TICKET_CATEGORY_TO_DB["early-bird"]).toBe("EARLY_BIRD");
    expect(M.TICKET_STATUS_TO_DB["checked-in"]).toBe("CHECKED_IN");
    expect(M.SESSION_AVAILABILITY_TO_DB["almost-full"]).toBe("ALMOST_FULL");

    expect(M.COLLAB_ROLE_TO_DB["co-host"]).toBe("CO_HOST");

    expect(M.EVENT_MODE_FROM_DB.ONE_TIME).toBe("one-time");
    expect(M.TICKET_CATEGORY_FROM_DB.EARLY_BIRD).toBe("early-bird");
  });
});
