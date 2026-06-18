/**
 * @sunday/web-auth — shared Next.js auth for the Sunday suite.
 *
 * The Sunday Account login recipe, extracted once: shared cookie options, the
 * `@supabase/ssr` server/browser clients, the middleware session refresh + route
 * gate, the hardened OAuth callback, and the server-side guards
 * (`requireUser` / `requireAppAccess`). Everything is CROSS-PROJECT-AWARE — the
 * AUTH Supabase project (the one that issues the Sunday Account session) is
 * passed in explicitly via {@link AuthClientConfig}, never assumed to be the
 * app's own data project.
 *
 * The guards + clients + callback are the must-use CORE; {@link LoginForm} is an
 * optional headless convenience.
 */
export { sharedCookieOptions } from "./cookies.js";
export type { AuthClientConfig } from "./config.js";
export { createServerAuthClient } from "./server.js";
export { createBrowserAuthClient } from "./browser.js";
export { updateSession } from "./middleware.js";
export type { SessionGateConfig } from "./middleware.js";
export {
  requireUser,
  requireAppAccess,
  isAdminEmail,
} from "./guards.js";
export type {
  AuthCapableClient,
  AuthUser,
  AppAccessOptions,
} from "./guards.js";
export { callbackHandler, sanitizeNext } from "./callback.js";
export type { CallbackConfig } from "./callback.js";
export { AuthError, authFail } from "./errors.js";
export { LoginForm } from "./LoginForm.js";
export type { LoginFormProps, LoginFormClassNames } from "./LoginForm.js";
