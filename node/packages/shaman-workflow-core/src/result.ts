/**
 * packages/shaman-workflow-core/src/result.ts
 *
 * Result type for error handling without exceptions.
 */

/**
 * Result type for functional error handling
 */
export type Result<T, E = Error> =
  | {
      readonly success: true;
      readonly data: T;
    }
  | {
      readonly success: false;
      readonly error: E;
    };