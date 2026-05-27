#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    timeout: 1_000,
    maxBuffer: 64 * 1024,
  });

  return stdout.trim();
}

const commit = await git(["rev-parse", "HEAD"]);
const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
const status = await git(["status", "--porcelain"]);
const buildInfoPath = resolve(process.cwd(), "dist/build-info.json");

await mkdir(dirname(buildInfoPath), { recursive: true });
await writeFile(buildInfoPath, `${JSON.stringify({
  commit,
  shortCommit: commit.slice(0, 12),
  branch,
  dirty: status.length > 0,
  builtAt: new Date().toISOString(),
}, null, 2)}\n`);

console.log(`Wrote ${buildInfoPath}`);
