/**
 * JWT utilities
 */

import jwt from "jsonwebtoken";

/**
 * Create a JWT token
 */
export async function createJWT(
  payload: Record<string, unknown>,
  secret: string,
  options?: { expiresIn?: string },
): Promise<string> {
  return jwt.sign(payload, secret, {
    expiresIn: options?.expiresIn || "1h",
  } as jwt.SignOptions);
}

/**
 * Verify a JWT token
 */
export async function verifyJWT(
  token: string,
  secret: string,
): Promise<Record<string, unknown>> {
  return jwt.verify(token, secret) as Record<string, unknown>;
}
