import { describe, it, expect, beforeAll } from "vitest";
import { signSessionToken, verifySessionToken } from "./jwt";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long-for-hs256";
});

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a valid payload", async () => {
    const token = await signSessionToken({ sub: "user_123", sessionId: "session_abc" }, 3600);
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "user_123", sessionId: "session_abc" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSessionToken({ sub: "user_123", sessionId: "session_abc" }, 3600);
    const tampered = token.slice(0, -4) + "abcd";
    const payload = await verifySessionToken(tampered);
    expect(payload).toBeNull();
  });

  it("rejects a garbage string", async () => {
    const payload = await verifySessionToken("not.a.jwt");
    expect(payload).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSessionToken({ sub: "user_123", sessionId: "session_abc" }, -1);
    const payload = await verifySessionToken(token);
    expect(payload).toBeNull();
  });
});
