/**
 * packages/shaman-core/src/types/option.ts
 *
 * Option<T> type for handling optional values.
 */

export type Option<T> = Some<T> | None;

export type Some<T> = {
  readonly _tag: 'Some';
  readonly value: T;
};

export type None = {
  readonly _tag: 'None';
};

export const some = <T>(value: T): Option<T> => ({ _tag: 'Some', value });
export const none: Option<never> = { _tag: 'None' };

export const isSome = <T>(option: Option<T>): option is Some<T> => option._tag === 'Some';
export const isNone = <T>(option: Option<T>): option is None => option._tag === 'None';
