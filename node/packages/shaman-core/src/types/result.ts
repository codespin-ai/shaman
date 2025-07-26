/**
 * packages/shaman-core/src/types/result.ts
 *
 * Result<T,E> union + helpers.
 */

export type Result<T, E = Error> = Success<T> | Failure<E>;

export type Success<T> = {
  readonly success: true;
  readonly data: T;
};

export type Failure<E = Error> = {
  readonly success: false;
  readonly error: E;
};

export const success = <T>(data: T): Success<T> => ({
  success: true,
  data,
});

export const failure = <E = Error>(error: E): Failure<E> => ({
  success: false,
  error,
});