/**
 * packages/shaman-git-resolver/src/agent-discovery.ts
 *
 * This module is responsible for finding and parsing agent definition files from a local directory.
 */

import { glob } from 'glob';
import matter from 'gray-matter';
import fs from 'fs-extra';

export interface ParsedAgentFile {
  filePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export async function findAgentFiles(dir: string): Promise<string[]> {
  // Find all markdown files, but ignore node_modules
  const pattern = '**/*.md';
  const files = await glob(pattern, {
    cwd: dir,
    nodir: true,
    absolute: true,
    ignore: '**/node_modules/**',
  });
  return files;
}

export async function parseAgentFile(filePath: string): Promise<ParsedAgentFile> {
  const fileContent = await fs.readFile(filePath, 'utf8');
  const { data, content } = matter(fileContent);
  return { filePath, frontmatter: data, content };
}
