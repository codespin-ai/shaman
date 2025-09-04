import { Result, success, failure } from "@codespin/shaman-core";

/**
 * Simple Bearer token authentication for trusted environments.
 * This is a simplified authentication pattern suitable when Shaman
 * runs behind a firewall in a fully trusted environment.
 */

/**
 * Extract and validate Bearer token from Authorization header
 * @param authHeader - The Authorization header value
 * @returns The extracted token or null if invalid
 */
export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Validate a Bearer token against configured token
 * @param token - The token to validate
 * @param configuredToken - The expected token from configuration
 * @returns Result indicating success or failure
 */
export function validateBearerToken(
  token: string,
  configuredToken: string | undefined,
): Result<void, Error> {
  // If no token is configured, authentication is disabled
  if (!configuredToken) {
    return success(undefined);
  }

  // Simple string comparison for trusted environments
  if (token === configuredToken) {
    return success(undefined);
  }

  return failure(new Error("Invalid Bearer token"));
}

/**
 * Authenticate a request using Bearer token
 * @param authHeader - The Authorization header value
 * @param configuredToken - The expected token from configuration
 * @returns Result indicating success or failure
 */
export function authenticateBearer(
  authHeader: string | undefined,
  configuredToken: string | undefined,
): Result<void, Error> {
  // If no token is configured, authentication is disabled
  if (!configuredToken) {
    return success(undefined);
  }

  const token = extractBearerToken(authHeader);
  if (!token) {
    return failure(new Error("Missing or invalid Bearer token"));
  }

  return validateBearerToken(token, configuredToken);
}
