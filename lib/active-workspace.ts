/**
 * The workspace a manager is currently looking at.
 *
 * A cookie rather than localStorage: the dashboard renders on the server, so
 * the choice has to be readable there. The previous switcher wrote to
 * localStorage, which nothing server-side could see — selecting a workspace
 * changed the label and nothing else.
 *
 * The value is never trusted on its own; `requireManagerPage()` intersects it
 * with the caller's actual memberships.
 */
export const ACTIVE_WORKSPACE_COOKIE = "poster_workspace";
