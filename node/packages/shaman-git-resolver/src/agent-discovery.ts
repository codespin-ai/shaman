/**
 * @fileoverview Discovers and parses agent definitions from a Git repository.
 */

import { Result, success, failure } from '@shaman/core/types/result.js';
import { GitAgent } from '@shaman/core/types/agent.js';
import { GitRepository } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

const AGENT_FILE_NAMES = ['prompt.md', 'agent.json'];

/**
 * Scans a directory for agent definition files.
 * @param dir - The directory to scan.
 * @returns A list of paths to agent definition files.
 */
async function findAgentFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return findAgentFiles(fullPath);
    }
    if (AGENT_FILE_NAMES.includes(entry.name)) {
      return [fullPath];
    }
    return [];
  }));
  return files.flat();
}

/**
 * Parses an agent definition file.
 * @param filePath - The path to the agent definition file.
 * @returns The parsed agent configuration.
 */
async function parseAgentFile(filePath: string): Promise<Result<any, Error>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (path.basename(filePath) === 'agent.json') {
      return success(JSON.parse(content));
    } else {
      const match = content.match(/^---([\s\S]+?)---/);
      if (match) {
        const frontmatter = yaml.load(match[1]);
        return success({ ...frontmatter, prompt: content });
      }
      return failure(new Error(`No frontmatter found in ${filePath}`));
    }
  } catch (error) {
    return failure(error as Error);
  }
}

/**
 * Discovers and parses all agents in a repository.
 * @param repo - The repository to scan.
 * @param commitHash - The commit hash of the repository.
 * @param baseDir - The base directory where repositories are stored.
 * @returns A list of discovered agents and a list of errors.
 */
export async function discoverAgents(
  repo: GitRepository,
  commitHash: string,
  baseDir: string
): Promise<{ agents: GitAgent[], errors: { file: string, error: Error }[] }> {
  const repoPath = path.join(baseDir, repo.path);
  const agentFiles = await findAgentFiles(repoPath);
  const results = await Promise.all(agentFiles.map(async (file) => {
    const parseResult = await parseAgentFile(file);
    if (!parseResult.success) {
      return { file, error: parseResult.error };
    }
    const agentData = parseResult.data;
    const validationResult = validateAgent(agentData, file);
    if (!validationResult.success) {
        return { file, error: validationResult.error };
    }
    const agent: GitAgent = {
      name: agentData.name,
      description: agentData.description,
      llm: agentData.llm,
      allowedTools: agentData.allowedTools || [],
      allowedAgents: agentData.allowedAgents || [],
      source: 'git',
      repositoryUrl: repo.url,
      commitHash,
      filePath: path.relative(repoPath, file),
      prompt: agentData.prompt || '',
    };
    return { agent };
  }));

  const agents: GitAgent[] = [];
  const errors: { file: string, error: Error }[] = [];

  for (const result of results) {
    if (result.agent) {
      agents.push(result.agent);
    } else {
      errors.push(result as { file: string, error: Error });
    }
  }

  return { agents, errors };
}
