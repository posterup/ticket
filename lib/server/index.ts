/**
 * Server-only data-access barrel. Import via `@/lib/server`.
 *
 * Everything behind this barrel is an in-memory mock (see `store.ts`) and is
 * intended to be swapped for a real datastore without changing call sites.
 */
export * from "./events";
export * from "./tickets";
export * from "./discounts";
export * from "./engagement";
export * from "./attendees";
export * from "./guests";
export * from "./collaborators";
export * from "./workspaces";
export * from "./campaigns";
export * from "./checkins";
