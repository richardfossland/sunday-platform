import { describe, expect, it } from "vitest";

import { logoutEverywhere, type GlobalSignOutClient } from "../src/logout.js";

/** A fake supabase-js client that records the signOut scope it was called with. */
function fakeClient(result: { error: unknown | null }): {
  client: GlobalSignOutClient;
  calls: Array<{ scope: string }>;
} {
  const calls: Array<{ scope: string }> = [];
  const client: GlobalSignOutClient = {
    auth: {
      async signOut(opts) {
        calls.push({ scope: opts.scope });
        return result;
      },
    },
  };
  return { client, calls };
}

describe("logoutEverywhere", () => {
  it("revokes with the GLOBAL scope (the single-logout backbone)", async () => {
    const { client, calls } = fakeClient({ error: null });
    await logoutEverywhere(client);
    expect(calls).toEqual([{ scope: "global" }]);
  });

  it("rejects when GoTrue reports an error (authoritative step must not fail quietly)", async () => {
    const { client } = fakeClient({ error: { message: "boom" } });
    await expect(logoutEverywhere(client)).rejects.toThrow(/single-logout failed/);
  });

  it("resolves to void on success", async () => {
    const { client } = fakeClient({ error: null });
    await expect(logoutEverywhere(client)).resolves.toBeUndefined();
  });
});
