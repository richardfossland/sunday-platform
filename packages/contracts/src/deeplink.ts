import { z } from "zod";

import { nullableField, SundayContractError } from "./common.js";

/**
 * Sunday Bridge deep links — local desktop↔desktop handoff. A sister app launches
 * the target with a `<scheme>://import?…` URL so a media file flows straight into
 * it with its context already filled in (e.g. SundayRec → SundayEdit/SundayStudio).
 *
 * This is the generalized superset of SundayEdit's `deeplink.rs`
 * (`sundayedit://import?path=…&language=…&context=…&glossary=…&returnTo=…`) plus
 * `media_kind`, `service_id` and `church_id`. The grammar is identical so existing
 * `sundayedit://import` links keep parsing. Unknown query keys are ignored
 * (forward-compatible); everything is `application/x-www-form-urlencoded`
 * (`+` → space, `%XX` → byte).
 */

export const MediaKind = z.enum(["video", "audio"]);
export type MediaKind = z.infer<typeof MediaKind>;

/** The only deep-link action understood today. */
export const ACTION_IMPORT = "import";

/** A validated media handoff parsed from (or rendered to) an import deep link. */
export const MediaHandoff = z.object({
  action: z.literal("import"),
  /** Absolute path to the source media file. Always present. */
  path: z.string().min(1),
  media_kind: nullableField(MediaKind),
  language: nullableField(z.string()),
  /** Free-text priming for context-aware recognition. */
  context: nullableField(z.string()),
  /** Glossary terms (speaker names, jargon) — de-duplicated, order preserved. */
  glossary: z.array(z.string()),
  /** Optional originating service, so the target can link back to it. */
  service_id: nullableField(z.string()),
  church_id: nullableField(z.string()),
  /** Scheme of the app that launched us, so it can hand results back. */
  return_to: nullableField(z.string()),
});
export type MediaHandoff = z.infer<typeof MediaHandoff>;

/**
 * Parse a `<expectedScheme>://import?…` URL into a {@link MediaHandoff}.
 * Throws {@link SundayContractError} for anything that isn't a well-formed import
 * link with a non-empty `path`.
 */
export function parseHandoffUrl(url: string, expectedScheme: string): MediaHandoff {
  const trimmed = url.trim();

  const rest = stripScheme(trimmed, expectedScheme);
  if (rest === null) {
    throw new SundayContractError(`not a ${expectedScheme}:// link: ${url}`);
  }

  const qIdx = rest.indexOf("?");
  const actionPart = qIdx === -1 ? rest : rest.slice(0, qIdx);
  const query = qIdx === -1 ? "" : rest.slice(qIdx + 1);
  const action = actionPart.replace(/^\/+/, "").replace(/\/+$/, "");
  if (action.toLowerCase() !== ACTION_IMPORT) {
    throw new SundayContractError(
      `unsupported deep-link action: ${JSON.stringify(action)} (expected "${ACTION_IMPORT}")`,
    );
  }

  let path: string | null = null;
  let mediaKind: MediaKind | null = null;
  let language: string | null = null;
  let context: string | null = null;
  let glossary: string[] = [];
  let serviceId: string | null = null;
  let churchId: string | null = null;
  let returnTo: string | null = null;

  for (const pair of query.split("&").filter((s) => s.length > 0)) {
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? "" : pair.slice(eq + 1);
    const key = decodeComponent(rawKey);
    const value = decodeComponent(rawVal);
    switch (key) {
      case "path":
        path = nonEmpty(value);
        break;
      case "media_kind":
      case "kind":
        mediaKind = parseMediaKind(value);
        break;
      case "language":
      case "lang":
        language = nonEmpty(value);
        break;
      case "context":
        context = nonEmpty(value);
        break;
      case "glossary":
        glossary = splitGlossary(value);
        break;
      case "service_id":
        serviceId = nonEmpty(value);
        break;
      case "church_id":
        churchId = nonEmpty(value);
        break;
      case "returnTo":
      case "return_to":
        returnTo = nonEmpty(value);
        break;
      default:
        break; // forward-compatible: ignore unknown keys
    }
  }

  if (path === null) {
    throw new SundayContractError("deep-link import is missing a non-empty `path`");
  }

  return MediaHandoff.parse({
    action: "import",
    path,
    media_kind: mediaKind,
    language,
    context,
    glossary,
    service_id: serviceId,
    church_id: churchId,
    return_to: returnTo,
  });
}

/** Render a {@link MediaHandoff} back into a `<scheme>://import?…` URL. */
export function buildHandoffUrl(scheme: string, h: MediaHandoff): string {
  const parts: string[] = [`path=${encodeComponent(h.path)}`];
  if (h.media_kind) parts.push(`media_kind=${h.media_kind}`);
  if (h.language) parts.push(`language=${encodeComponent(h.language)}`);
  if (h.context) parts.push(`context=${encodeComponent(h.context)}`);
  if (h.glossary.length > 0) parts.push(`glossary=${encodeComponent(h.glossary.join(","))}`);
  if (h.service_id) parts.push(`service_id=${encodeComponent(h.service_id)}`);
  if (h.church_id) parts.push(`church_id=${encodeComponent(h.church_id)}`);
  if (h.return_to) parts.push(`returnTo=${encodeComponent(h.return_to)}`);
  return `${scheme}://${ACTION_IMPORT}?${parts.join("&")}`;
}

/**
 * Build the hand-back URL the caller listens for once the target has produced a
 * result file: `<returnTo>://result?path=<encoded>`. Mirrors SundayEdit's
 * `captions_callback_url`. `returnTo` must be a clean URL scheme.
 */
export function resultCallbackUrl(returnTo: string, resultPath: string): string {
  const scheme = returnTo.trim();
  const valid =
    scheme.length > 0 &&
    /^[a-zA-Z]/.test(scheme) &&
    /^[a-zA-Z0-9+\-.]+$/.test(scheme);
  if (!valid) {
    throw new SundayContractError(`invalid returnTo scheme: ${JSON.stringify(returnTo)}`);
  }
  return `${scheme}://result?path=${encodeComponent(resultPath)}`;
}

// ── URL component codec (matches SundayEdit deeplink.rs byte-for-byte) ─────────

/**
 * Percent-encode a query-component value: RFC 3986 unreserved chars pass through,
 * everything else (incl. `/`, spaces, non-ASCII) becomes `%XX`. Spaces always
 * encode as `%20`, never `+`, so they survive the `+`→space decode rule.
 */
export function encodeComponent(s: string): string {
  const src = new TextEncoder().encode(s);
  let out = "";
  for (const b of src) {
    if (
      (b >= 0x41 && b <= 0x5a) || // A-Z
      (b >= 0x61 && b <= 0x7a) || // a-z
      (b >= 0x30 && b <= 0x39) || // 0-9
      b === 0x2d || // -
      b === 0x5f || // _
      b === 0x2e || // .
      b === 0x7e // ~
    ) {
      out += String.fromCharCode(b);
    } else {
      out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

/**
 * Percent-decode one query component. `%XX` → byte, `+` → space, everything else
 * verbatim. Invalid `%` escapes are left as-is rather than rejected.
 */
export function decodeComponent(s: string): string {
  const src = new TextEncoder().encode(s);
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const b = src[i]!;
    if (b === 0x2b) {
      out.push(0x20);
      i += 1;
    } else if (b === 0x25 && i + 2 < src.length) {
      const hi = hexVal(src[i + 1]!);
      const lo = hexVal(src[i + 2]!);
      if (hi !== null && lo !== null) {
        out.push((hi << 4) | lo);
        i += 3;
      } else {
        out.push(0x25);
        i += 1;
      }
    } else {
      out.push(b);
      i += 1;
    }
  }
  return new TextDecoder().decode(new Uint8Array(out));
}

function hexVal(b: number): number | null {
  if (b >= 0x30 && b <= 0x39) return b - 0x30;
  if (b >= 0x61 && b <= 0x66) return b - 0x61 + 10;
  if (b >= 0x41 && b <= 0x46) return b - 0x41 + 10;
  return null;
}

function stripScheme(s: string, scheme: string): string | null {
  const prefixLen = scheme.length + 1;
  if (s.length < prefixLen) return null;
  const name = s.slice(0, scheme.length);
  const colon = s.slice(scheme.length, prefixLen);
  if (colon !== ":" || name.toLowerCase() !== scheme.toLowerCase()) return null;
  const tail = s.slice(prefixLen);
  return tail.startsWith("//") ? tail.slice(2) : tail;
}

function nonEmpty(s: string): string | null {
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function parseMediaKind(value: string): MediaKind | null {
  const v = value.trim().toLowerCase();
  return v === "video" || v === "audio" ? v : null;
}

/** Comma-separated → trimmed, non-empty, case-insensitively de-duplicated. */
function splitGlossary(value: string): string[] {
  const seen: string[] = [];
  const out: string[] = [];
  for (const term of value.split(",")) {
    const t = term.trim();
    if (t.length === 0) continue;
    const lower = t.toLowerCase();
    if (seen.includes(lower)) continue;
    seen.push(lower);
    out.push(t);
  }
  return out;
}
