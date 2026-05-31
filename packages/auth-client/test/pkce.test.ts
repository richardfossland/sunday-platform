import { describe, expect, it } from "vitest";

import {
  codeChallengeS256,
  createPkcePair,
  generateCodeVerifier,
  randomState,
} from "../src/index.js";

describe("PKCE", () => {
  it("matches the RFC 7636 test vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(await codeChallengeS256(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("generates a 43-char verifier with only unreserved chars", () => {
    const v = generateCodeVerifier();
    expect(v).toHaveLength(43);
    expect(/^[A-Za-z0-9\-_]+$/.test(v)).toBe(true);
  });

  it("createPkcePair returns a matching verifier/challenge and a state", async () => {
    const pair = await createPkcePair();
    expect(pair.challenge).toBe(await codeChallengeS256(pair.verifier));
    expect(pair.state.length).toBeGreaterThan(0);
  });

  it("state values are random", () => {
    expect(randomState()).not.toBe(randomState());
  });
});
