/**
 * @fileoverview Manages cloning and updating Git repositories using shell commands.
 */

import { Result, success, failure } from '@shaman/core/types/result.js';
import { GitRepository } from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

const GIT_URL_REGEX = /^(https?:\/\/[\w\.-]+(\/[\w\.-]+)*|git@[\w\.-]+:[\w\.-]+\/[\w\.-]+)\.git$/;
const GIT_BRANCH_REGEX = /^[a-zA-Z0-9_\-\/]+$/;

type ValidationError = {
  field: keyof GitRepository;
  message: string;
};

/**
 * Validates the GitRepository configuration.
 * @param repo - The repository configuration to validate.
 * @returns A result indicating success or a list of validation errors.
 */
export function validateGitRepository(repo: GitRepository): Result<true, ValidationError[]> {
  const errors: ValidationError[] = [];

  if (!GIT_URL_REGEX.test(repo.url)) {
    errors.push({ field: 'url', message: 'Invalid Git URL format.' });
  }

  if (!GIT_BRANCH_REGEX.test(repo.branch)) {
    errors.push({ field: 'branch', message: 'Invalid branch name.' });
  }

  if (path.isAbsolute(repo.path) || repo.path.includes('..')) {
    errors.push({ field: 'path', message: 'Path must be a relative path and cannot contain "..".' });
  }

  if (errors.length > 0) {
    return failure(errors);
  }

  return success(true);
}

/**
 * Clones or updates a Git repository.
 * @param repo - The repository to sync.
 * @param baseDir - The base directory where repositories are stored.
 * @returns A result indicating success or an error.
 */
export async function syncRepository(repo: GitRepository, baseDir: string): Promise<Result<string, Error>> {
  const validationResult = validateGitRepository(repo);
  if (!validationResult.success) {
    return failure(new Error(`Invalid repository configuration: ${JSON.stringify(validationResult.error)}`));
  }

  const repoPath = path.join(baseDir, repo.path);

  try {
    await fs.mkdir(path.dirname(repoPath), { recursive: true });

    const stats = await fs.stat(repoPath).catch(() => null);

    if (stats && stats.isDirectory()) {
      // Directory exists, assume it's a git repo and pull
      console.log(`Updating repository: ${repo.name}`);
      await execAsync(`git -C "${repoPath}" fetch origin`);
      await execAsync(`git -C "${repoPath}" reset --hard origin/${repo.branch}`);
      await execAsync(`git -C "${repoPath}" clean -fdx`);
    } else {
      // Directory does not exist, clone it
      console.log(`Cloning repository: ${repo.name}`);
      await execAsync(`git clone --branch ${repo.branch} --single-branch ${repo.url} "${repoPath}"`);
    }

    const { stdout: commitHash } = await execAsync(`git -C "${repoPath}" rev-parse HEAD`);
    return success(commitHash.trim());
  } catch (error) {
    return failure(error as Error);
  }
}
