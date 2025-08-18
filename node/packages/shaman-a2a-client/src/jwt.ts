import * as jwt from "jsonwebtoken";
import type { InternalJWTPayload } from "./types.js";

/**
 * Generate an internal JWT token for agent-to-agent communication
 */
export function generateInternalJWT(
  payload: InternalJWTPayload,
  secret: string,
  expiresIn: string | number = "1h",
): string {
  const options: jwt.SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, secret, options);
}

/**
 * Verify an internal JWT token
 */
export function verifyInternalJWT(
  token: string,
  secret: string,
): InternalJWTPayload {
  return jwt.verify(token, secret) as InternalJWTPayload;
}
