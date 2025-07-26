/**
 * packages/shaman-git-resolver/src/git-manager.ts
 *
 * This module handles low-level git operations using isomorphic-git.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';
import fs from 'fs-extra';
import path from 'path';

const REPO_ROOT = path.resolve(process.cwd(), '.repos');

async function getRepoDir(repoName: string): Promise<string> {
  const dir = path.join(REPO_ROOT, repoName);
  await fs.ensureDir(dir);
  return dir;
}

export async function cloneOrPull(gitUrl: string, branch: string, repoName: string): Promise<string> {
  const dir = await getRepoDir(repoName);
  const gitignorePath = path.join(dir, '.gitignore');

  try {
    // Check if the directory is a git repository
    await git.resolveRef({ fs, dir, ref: 'HEAD' });

    // If it is, pull the latest changes
    await git.pull({
      fs,
      http,
      dir,
      ref: branch,
      singleBranch: true,
      author: { name: 'Shaman' },
    });
  } catch (e) {
    // If it's not a git repository (or on first run), clone it
    await git.clone({
      fs,
      http,
      dir,
      url: gitUrl,
      ref: branch,
      singleBranch: true,
      depth: 1,
    });
    // Ensure node_modules is ignored if not already
    if (!fs.existsSync(gitignorePath)) {
      await fs.writeFile(gitignorePath, 'node_modules\n');
    }
  }
  return dir;
}

export async function getLatestCommitHash(repoName: string): Promise<string> {
  const dir = await getRepoDir(repoName);
  const oid = await git.resolveRef({ fs, dir, ref: 'HEAD' });
  return oid;
}
