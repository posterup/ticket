/**
 * Request schemas for the venue designer and the seat map.
 *
 * The layout spec is validated structurally here and semantically in
 * `validateSpec()` — zod checks that a shape *is* a polygon, `validateSpec`
 * checks that the polygon makes a sellable section. Keeping the operator-facing
 * Persian messages out of zod keeps both readable.
 */

import { z } from "zod";

import { MAX_SEATS_PER_HOLDER } from "@/lib/server/venues/holds";

const point = z.tuple([z.number(), z.number()]);

const rectShape = z.object({
  type: z.literal("rect"),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().optional(),
});

const polygonShape = z.object({
  type: z.literal("polygon"),
  points: z.array(point).min(3),
});

const arcShape = z.object({
  type: z.literal("arc"),
  cx: z.number(),
  cy: z.number(),
  rInner: z.number().nonnegative(),
  rOuter: z.number().positive(),
  startAngle: z.number(),
  endAngle: z.number(),
});

const sectionShape = z.discriminatedUnion("type", [
  rectShape,
  polygonShape,
  arcShape,
]);

const numbering = z.object({
  rowScheme: z.enum(["latin", "numeric", "persian-alpha", "custom"]),
  rowLabels: z.array(z.string()).optional(),
  rowDirection: z.enum(["front-to-back", "back-to-front"]),
  seatScheme: z.enum(["sequential", "odd-even", "block"]),
  seatStart: z.number().int().min(0),
  seatOrigin: z.enum(["left", "right"]),
  skip: z.array(z.number().int()).optional(),
});

const rowGenerator = z.object({
  count: z.number().int().min(1).max(400),
  spacing: z.number().positive(),
  seatSpacing: z.number().positive(),
  origin: point,
  angle: z.number(),
  curve: z.number(),
  seatsPerRow: z.union([
    z.number().int().min(0).max(400),
    z.array(z.number().int().min(0).max(400)),
  ]),
  numbering,
});

const seatOverride = z.object({
  kind: z
    .enum(["standard", "wheelchair", "companion", "obstructed", "house"])
    .optional(),
  label: z.string().optional(),
  dx: z.number().optional(),
  dy: z.number().optional(),
});

const sectionSpec = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "شناسه بخش فقط حروف کوچک، عدد و خط تیره."),
  name: z.string().min(1).max(80),
  kind: z.enum(["seated", "standing"]),
  shape: sectionShape,
  color: z.string().min(1).max(40),
  tier: z.number().int().min(1).max(20),
  labelAt: point.optional(),
  rows: rowGenerator.optional(),
  capacity: z.number().int().min(0).optional(),
  overrides: z.record(z.string(), seatOverride).optional(),
});

export const layoutSpecSchema = z.object({
  version: z.number().int().min(1),
  bounds: z.object({
    width: z.number().positive().max(20_000),
    height: z.number().positive().max(20_000),
  }),
  stage: z
    .object({ shape: sectionShape, label: z.string().max(40) })
    .optional(),
  // 200 is far past any real venue and stops a runaway client wedging publish.
  sections: z.array(sectionSpec).max(200),
});

export const saveDraftSchema = z.object({ draft: layoutSpecSchema });

export const holdSeatsSchema = z.object({
  section: z.string().min(1),
  seats: z
    .array(z.number().int().min(0))
    .min(1)
    .max(MAX_SEATS_PER_HOLDER)
    .refine((v) => new Set(v).size === v.length, "صندلی تکراری فرستاده شده."),
});

/**
 * "Find me N good seats."
 *
 * No seat indices: the buyer is explicitly declining to choose, and the server
 * picks. `maxPrice` is a per-seat Toman ceiling, not a basket total — that is
 * how buyers describe a budget for tickets.
 */
export const bestAvailableSchema = z.object({
  quantity: z.number().int().min(1).max(10),
  section: z.string().min(1).max(64).optional(),
  maxPrice: z.number().int().positive().optional(),
  accessible: z.boolean().optional(),
});

export const releaseSeatsSchema = z.object({
  section: z.string().min(1).optional(),
  seats: z.array(z.number().int().min(0)).optional(),
});

/**
 * `PATCH /api/events/:id/seatmap` — adopt a layout and price it.
 *
 * One body rather than two endpoints: a layout whose sections are unpriced
 * refuses every purchase, so allowing the two to be set independently invites
 * a half-configured event going on sale.
 */
export const attachLayoutSchema = z.object({
  sessionId: z.string().min(1),
  /** Null detaches the seat map and returns the showing to open seating. */
  layoutVersionId: z.string().min(1).nullable(),
  /** Omit to leave the current pricing alone; send `[]` to clear it. */
  pricing: z
    .array(
      z.object({
        sectionKey: z.string().min(1),
        ticketTypeId: z.string().min(1),
      }),
    )
    .optional(),
});
