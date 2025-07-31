/**
 * JWT utilities for internal A2A authentication
 */

import jwt from 'jsonwebtoken';
import type { WorkflowContext } from '@codespin/shaman-types';
import type { InternalJWTPayload } from './types.js';

/**
 * Generate an internal JWT token for A2A calls
 */
export function generateInternalJWT(
  context: WorkflowContext,
  secret: string,
  expiresIn: number = 300 // 5 minutes default
): string {
  const payload: InternalJWTPayload = {
    iss: 'shaman-public-server',
    aud: 'shaman-internal-server',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    context: {
      tenantId: context.tenantId,
      runId: context.runId,
      parentTaskId: context.parentStepId,
      depth: context.depth
    }
  };
  
  return jwt.sign(payload, secret);
}

/**
 * Verify an internal JWT token
 */
export function verifyInternalJWT(
  token: string,
  secret: string
): InternalJWTPayload {
  const decoded = jwt.verify(token, secret, {
    issuer: 'shaman-public-server',
    audience: 'shaman-internal-server'
  }) as InternalJWTPayload;
  
  return decoded;
}