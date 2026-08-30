import { SignJWT, jwtVerify } from "jose";

const alg = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters. See .env.example."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionTokenPayload {
  sub: string; // userId
  sessionId: string;
}

export async function signSessionToken(
  payload: SessionTokenPayload,
  expiresInSeconds: number
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string" || typeof payload.sessionId !== "string") {
      return null;
    }
    return { sub: payload.sub, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}
