/**
 * @fileoverview Defines the types for Git repository management.
 */

export type GitRepository = {
  readonly name: string;
  readonly url: string;
  readonly path: string;
  readonly branch: string;
  readonly isRoot?: boolean;
};
