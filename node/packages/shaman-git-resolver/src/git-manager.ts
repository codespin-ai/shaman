/**
 * packages/shaman-git-resolver/src/git-manager.ts
 *
 * This module handles low-level git operations using git commands.
 */

import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createLogger } from "@codespin/shaman-logger";

const execAsync = promisify(exec);
const REPO_ROOT = path.resolve(process.cwd(), ".repos");

async function getRepoDir(repoName: string): Promise<string> {
  const dir = path.join(REPO_ROOT, repoName);
  await fs.ensureDir(dir);
  return dir;
}

export async function cloneOrPull(
  gitUrl: string,
  branch: string,
  repoName: string,
): Promise<string> {
  const dir = await getRepoDir(repoName);
  const gitignorePath = path.join(dir, ".gitignore");
  const gitDir = path.join(dir, ".git");

  try {
    // Check if the directory is a git repository
    if (await fs.pathExists(gitDir)) {
      // If it is, fetch and checkout the latest changes
      await execAsync(`git fetch origin ${branch}`, { cwd: dir });
      await execAsync(`git checkout ${branch}`, { cwd: dir });
      await execAsync(`git reset --hard origin/${branch}`, { cwd: dir });
    } else {
      // If it's not a git repository, clone it
      await execAsync(
        `git clone --single-branch --branch ${branch} --depth 1 ${gitUrl} ${dir}`,
      );

      // Ensure node_modules is ignored if not already
      if (!(await fs.pathExists(gitignorePath))) {
        await fs.writeFile(gitignorePath, "node_modules\n");
      }
    }
  } catch (error) {
    const logger = createLogger("GitManager");
    logger.error(
      `Git operation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }

  return dir;
}

export async function getLatestCommitHash(
  repoPath: string,
  branch: string = "main",
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git rev-parse ${branch}`, {
      cwd: repoPath,
    });
    return stdout.trim();
  } catch (error) {
    const logger = createLogger("GitManager");
    logger.error(
      `Failed to get commit hash for branch ${branch}:`,
      error instanceof Error ? error : undefined,
    );
    throw error;
  }
}

export async function getFileCommitHash(
  repoPath: string,
  filePath: string,
  branch: string = "main",
): Promise<string | null> {
  try {
    // Get the most recent commit that affected this file
    const relativePath = path.relative(repoPath, filePath);
    const { stdout } = await execAsync(
      `git log -1 --format=%H ${branch} -- "${relativePath}"`,
      { cwd: repoPath },
    );

    const commitHash = stdout.trim();
    return commitHash || null;
  } catch (error) {
    const logger = createLogger("GitManager");
    logger.error(`Error getting commit hash for file ${filePath}:`, error);
    return null;
  }
}
