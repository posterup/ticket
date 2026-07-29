import { describe, it, expect } from "vitest";

import {
  canOnEvent,
  canOnWorkspace,
  resolveEventPermissions,
  resolveWorkspacePermissions,
  __testing,
  type EventAccessInput,
  type EventPermission,
} from "@/lib/server/auth/permissions";
import type { EventCollabRole, WorkspaceRole } from "@/types";

/**
 * An authorization bug fails silently — nothing throws, the wrong person just
 * succeeds. So these assert the matrix exhaustively rather than spot-checking:
 * every role is pinned to an exact permission set, and the negative cases are
 * named individually.
 */

const ANON: EventAccessInput = {
  membershipRole: null,
  collaboratorRole: null,
  publiclyVisible: false,
};

function asMember(role: WorkspaceRole, over: Partial<EventAccessInput> = {}) {
  return { ...ANON, membershipRole: role, ...over };
}
function asCollaborator(
  role: EventCollabRole,
  over: Partial<EventAccessInput> = {},
) {
  return { ...ANON, collaboratorRole: role, ...over };
}
function granted(input: EventAccessInput): EventPermission[] {
  return [...resolveEventPermissions(input).permissions].sort();
}

describe("anonymous callers", () => {
  it("get nothing on a private or draft event", () => {
    expect(granted(ANON)).toEqual([]);
    expect(resolveEventPermissions(ANON).source).toBeNull();
  });

  it("get read-only on a publicly visible event", () => {
    const input = { ...ANON, publiclyVisible: true };
    expect(granted(input)).toEqual(["event:read"]);
    expect(resolveEventPermissions(input).source).toBe("public");
  });

  it("cannot edit a public event", () => {
    expect(canOnEvent({ ...ANON, publiclyVisible: true }, "event:edit")).toBe(
      false,
    );
  });
});

describe("workspace roles on an event", () => {
  it("owner gets every permission", () => {
    expect(granted(asMember("owner"))).toEqual(
      [...__testing.ALL_EVENT_PERMISSIONS].sort(),
    );
  });

  it("admin gets everything except deletion", () => {
    const admin = granted(asMember("admin"));
    expect(admin).toEqual(
      __testing.ALL_EVENT_PERMISSIONS.filter(
        (p) => p !== "event:delete",
      ).sort(),
    );
    expect(canOnEvent(asMember("admin"), "event:delete")).toBe(false);
    // An admin may still publish and manage collaborators.
    expect(canOnEvent(asMember("admin"), "event:publish")).toBe(true);
    expect(canOnEvent(asMember("admin"), "collaborators:manage")).toBe(true);
  });

  it("staff can only read and work the door", () => {
    expect(granted(asMember("staff"))).toEqual([
      "attendees:read",
      "checkin:perform",
      "event:read",
    ]);
  });

  it("staff cannot see or decide registrations", () => {
    expect(canOnEvent(asMember("staff"), "registrations:read")).toBe(false);
    expect(canOnEvent(asMember("staff"), "registrations:decide")).toBe(false);
    expect(canOnEvent(asMember("staff"), "event:edit")).toBe(false);
  });
});

describe("collaborator roles on an event", () => {
  it("co-host can run the event", () => {
    expect(granted(asCollaborator("co-host"))).toEqual([
      "attendees:read",
      "checkin:perform",
      "discounts:manage",
      "event:edit",
      "event:read",
      "guests:manage",
      "registrations:decide",
      "registrations:read",
      "tickets:manage",
    ]);
  });

  it("co-host cannot invite further collaborators", () => {
    // Otherwise a co-host could launder their own access into new grants.
    expect(canOnEvent(asCollaborator("co-host"), "collaborators:manage")).toBe(
      false,
    );
  });

  it("co-host cannot publish or delete", () => {
    expect(canOnEvent(asCollaborator("co-host"), "event:publish")).toBe(false);
    expect(canOnEvent(asCollaborator("co-host"), "event:delete")).toBe(false);
  });

  it("check-in collaborator gets only the door", () => {
    expect(granted(asCollaborator("checkin"))).toEqual([
      "checkin:perform",
      "event:read",
    ]);
    expect(canOnEvent(asCollaborator("checkin"), "attendees:read")).toBe(false);
  });
});

describe("combining sources", () => {
  it("takes the union of membership and collaboration", () => {
    const both = asMember("staff", { collaboratorRole: "co-host" });
    // Staff alone cannot edit; the co-host invite adds it.
    expect(canOnEvent(both, "event:edit")).toBe(true);
    expect(canOnEvent(both, "attendees:read")).toBe(true);
    // Neither source grants these.
    expect(canOnEvent(both, "event:delete")).toBe(false);
    expect(canOnEvent(both, "collaborators:manage")).toBe(false);
  });

  it("public visibility never dilutes a stronger source", () => {
    const owner = asMember("owner", { publiclyVisible: true });
    expect(resolveEventPermissions(owner).source).toBe("owner");
    expect(granted(owner)).toEqual([...__testing.ALL_EVENT_PERMISSIONS].sort());
  });

  it("reports the strongest contributing source", () => {
    expect(resolveEventPermissions(asMember("owner")).source).toBe("owner");
    expect(resolveEventPermissions(asMember("admin")).source).toBe("admin");
    expect(resolveEventPermissions(asCollaborator("co-host")).source).toBe(
      "collaborator",
    );
    expect(
      resolveEventPermissions(asMember("staff", { collaboratorRole: "co-host" }))
        .source,
    ).toBe("collaborator");
  });
});

describe("workspace-scoped permissions", () => {
  it("non-members get nothing", () => {
    expect([...resolveWorkspacePermissions(null)]).toEqual([]);
  });

  it("only the owner may withdraw funds", () => {
    expect(canOnWorkspace("owner", "finance:withdraw")).toBe(true);
    expect(canOnWorkspace("admin", "finance:withdraw")).toBe(false);
    expect(canOnWorkspace("staff", "finance:withdraw")).toBe(false);
    expect(canOnWorkspace(null, "finance:withdraw")).toBe(false);
  });

  it("admin can read finance and send campaigns but not reshape the workspace", () => {
    expect(canOnWorkspace("admin", "finance:read")).toBe(true);
    expect(canOnWorkspace("admin", "campaigns:send")).toBe(true);
    expect(canOnWorkspace("admin", "event:create")).toBe(true);
    expect(canOnWorkspace("admin", "workspace:edit")).toBe(false);
    expect(canOnWorkspace("admin", "workspace:delete")).toBe(false);
  });

  it("staff cannot send campaigns or create events", () => {
    expect(canOnWorkspace("staff", "campaigns:send")).toBe(false);
    expect(canOnWorkspace("staff", "event:create")).toBe(false);
    expect(canOnWorkspace("staff", "attendees:write")).toBe(false);
    expect(canOnWorkspace("staff", "attendees:read")).toBe(true);
  });
});

describe("grant tables are well-formed", () => {
  const ROLES: WorkspaceRole[] = ["owner", "admin", "staff"];

  it("every role's event grants are a subset of the known permissions", () => {
    const known = new Set<string>(__testing.ALL_EVENT_PERMISSIONS);
    for (const role of ROLES) {
      for (const p of __testing.EVENT_GRANTS_BY_WORKSPACE_ROLE[role]) {
        expect(known.has(p)).toBe(true);
      }
    }
    for (const role of ["co-host", "checkin"] as EventCollabRole[]) {
      for (const p of __testing.EVENT_GRANTS_BY_COLLAB_ROLE[role]) {
        expect(known.has(p)).toBe(true);
      }
    }
  });

  it("orders roles by strictly decreasing power", () => {
    const size = (r: WorkspaceRole) => granted(asMember(r)).length;
    expect(size("owner")).toBeGreaterThan(size("admin"));
    expect(size("admin")).toBeGreaterThan(size("staff"));
  });

  it("lists no permission twice", () => {
    for (const role of ROLES) {
      const list = __testing.EVENT_GRANTS_BY_WORKSPACE_ROLE[role];
      expect(new Set(list).size).toBe(list.length);
      const ws = __testing.WORKSPACE_GRANTS_BY_ROLE[role];
      expect(new Set(ws).size).toBe(ws.length);
    }
  });
});
