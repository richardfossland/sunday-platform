"use client";

import { useState } from "react";

import { createBrowserAuthClient } from "./browser.js";
import type { AuthClientConfig } from "./config.js";

/**
 * Styleable class hooks for {@link LoginForm}. Everything is optional — the
 * component ships with NO styling of its own (headless), so each app passes its
 * own classes (info's `.card`/`.btn`, stage's dark chrome, …). Defaults to empty
 * strings.
 */
export interface LoginFormClassNames {
  root?: string;
  form?: string;
  field?: string;
  label?: string;
  input?: string;
  submit?: string;
  googleButton?: string;
  error?: string;
  sent?: string;
}

export interface LoginFormProps {
  /** AUTH project config — same object passed to the server/middleware helpers. */
  config: AuthClientConfig;
  /** Path the magic link / OAuth redirect lands on. Defaults to `/auth/callback`. */
  callbackPath?: string;
  /** Show the "Sign in with Google" button. Defaults to `true`. */
  google?: boolean;
  /** Copy overrides (Norwegian defaults match the suite). */
  labels?: Partial<{
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
    submitting: string;
    google: string;
    sent: (email: string) => string;
    error: string;
  }>;
  classNames?: LoginFormClassNames;
}

const DEFAULT_LABELS = {
  emailLabel: "E-post",
  emailPlaceholder: "deg@menigheten.no",
  submit: "Send innloggingslenke",
  submitting: "Sender …",
  google: "Logg inn med Google",
  sent: (email: string) => `Sjekk innboksen til ${email} — vi har sendt deg en innloggingslenke.`,
  error: "Klarte ikke å sende lenken — sjekk adressen og prøv igjen.",
};

/**
 * Optional headless login form: magic link + Google, against the AUTH project.
 * The HELPERS (server/middleware/callback/guards) are the must-use core; this is
 * a convenience so apps don't re-hand-roll the same client login each time.
 *
 * Headless = no built-in styles; pass `classNames` to wire up your design
 * system. Extracted from SundayInfo's `app/login/page.tsx`.
 */
export function LoginForm({
  config,
  callbackPath = "/auth/callback",
  google = true,
  labels,
  classNames = {},
}: LoginFormProps) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserAuthClient(config);
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}${callbackPath}` },
      });
      if (err) throw err;
      setSent(true);
    } catch {
      setError(copy.error);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    const supabase = createBrowserAuthClient(config);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${callbackPath}` },
    });
  }

  return (
    <div className={classNames.root}>
      {sent ? (
        <p className={classNames.sent}>{copy.sent(email)}</p>
      ) : (
        <form className={classNames.form} onSubmit={sendMagicLink}>
          <div className={classNames.field}>
            <label className={classNames.label} htmlFor="sunday-login-email">
              {copy.emailLabel}
            </label>
            <input
              id="sunday-login-email"
              className={classNames.input}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              autoComplete="email"
            />
          </div>
          {error && <p className={classNames.error}>{error}</p>}
          <button className={classNames.submit} disabled={busy}>
            {busy ? copy.submitting : copy.submit}
          </button>
        </form>
      )}
      {google && (
        <button
          type="button"
          className={classNames.googleButton}
          onClick={signInWithGoogle}
        >
          {copy.google}
        </button>
      )}
    </div>
  );
}
