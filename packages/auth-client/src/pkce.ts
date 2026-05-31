/**
 * PKCE (RFC 7636) helpers for the Sunday ID login, using WebCrypto. Mirrors the
 * Rust `sunday-auth::pkce` byte-for-byte (same RFC test vector) so a flow can be
 * driven from either side.
 */

/** base64url (RFC 4648 §5) with no padding. */
function base64urlNopad(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The S256 code challenge for a verifier: base64url-nopad(SHA-256(verifier)). */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlNopad(new Uint8Array(digest));
}

/** A fresh 43-character code verifier from the platform CSPRNG. */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlNopad(bytes);
}

/** A random `state` value for CSRF protection on the authorize round-trip. */
export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64urlNopad(bytes);
}

/** Everything needed to start a PKCE authorize round-trip. */
export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

/** Generate a verifier + its S256 challenge + a random state in one call. */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeS256(verifier);
  return { verifier, challenge, state: randomState() };
}
