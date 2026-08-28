#!/usr/bin/env node
/**
 * Pushes the local content in src/content/ to the nanobook-content repository
 * on GitHub using the Git Data API.
 *
 * The remote repository becomes an exact mirror of the local content directory:
 * every local file is pushed, and any remote file not present locally is removed.
 *
 * Usage:
 *   node --env-file=.env scripts/push-content-to-github.mjs
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, posix } from "node:path";

const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const REPO_NAME = "nanobook-content";
const CONTENT_DIR = "src/content";
const BRANCH = "main";

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;

if (!token) {
  console.error("Missing GITHUB_TOKEN environment variable.");
  process.exit(1);
}

if (!owner) {
  console.error("Missing GITHUB_OWNER environment variable.");
  process.exit(1);
}

function getHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "nanobook-content-pusher",
    "Content-Type": "application/json",
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `GitHub API error ${response.status} ${response.statusText}: ${text}`,
    );
  }

  return data;
}

async function ensureRepo() {
  try {
    const repo = await fetchJson(
      `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}`,
    );
    console.log(`Repository ${owner}/${REPO_NAME} already exists.`);
    return repo;
  } catch (error) {
    if (!error.message.includes("404")) {
      throw error;
    }
  }

  console.log(`Creating repository ${owner}/${REPO_NAME}...`);
  return fetchJson(`${GITHUB_API_BASE}/user/repos`, {
    method: "POST",
    body: JSON.stringify({
      name: REPO_NAME,
      description: "Remote content for nanobook",
      private: false,
      auto_init: true,
      default_branch: BRANCH,
    }),
  });
}

async function getLatestCommitSha() {
  try {
    const ref = await fetchJson(
      `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
    );
    return ref.object.sha;
  } catch (error) {
    if (error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

async function scanContentFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const relativePath = relative(CONTENT_DIR, fullPath);
        files.push(relativePath);
      }
    }
  }

  await walk(dir);
  return files.sort();
}

function isBinary(buffer) {
  if (buffer.includes(0)) {
    return true;
  }

  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buffer);
    return false;
  } catch {
    return true;
  }
}

async function createBlob(buffer) {
  return fetchJson(
    `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/git/blobs`,
    {
      method: "POST",
      body: JSON.stringify({
        content: buffer.toString("base64"),
        encoding: "base64",
      }),
    },
  );
}

async function createTree(fileEntries) {
  const tree = fileEntries.map((file) => ({
    path: toPosixPath(file.path),
    mode: "100644",
    type: "blob",
    ...(file.sha ? { sha: file.sha } : { content: file.content }),
  }));

  return fetchJson(
    `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({ tree }),
    },
  );
}

async function createCommit(treeSha, parentSha, message) {
  const body = {
    message,
    tree: treeSha,
    parents: parentSha ? [parentSha] : [],
  };

  return fetchJson(
    `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

async function updateRef(commitSha) {
  return fetchJson(
    `${GITHUB_API_BASE}/repos/${owner}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: commitSha }),
    },
  );
}

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

async function main() {
  console.log(`Pushing content to ${owner}/${REPO_NAME}...\n`);

  await ensureRepo();

  const localFiles = await scanContentFiles(CONTENT_DIR);
  console.log(`Found ${localFiles.length} file(s) in ${CONTENT_DIR}.`);

  const fileEntries = await Promise.all(
    localFiles.map(async (file) => {
      const fullPath = join(CONTENT_DIR, file);
      const buffer = await readFile(fullPath);

      if (isBinary(buffer)) {
        const blob = await createBlob(buffer);
        console.log(`  - binary blob: ${file}`);
        return { path: file, sha: blob.sha };
      }

      console.log(`  - text: ${file}`);
      return { path: file, content: buffer.toString("utf-8") };
    }),
  );

  const latestCommitSha = await getLatestCommitSha();
  console.log(
    latestCommitSha
      ? `\nLatest commit on ${BRANCH}: ${latestCommitSha}`
      : `\nBranch ${BRANCH} is empty or does not exist yet.`,
  );

  console.log("Creating tree...");
  const tree = await createTree(fileEntries);

  console.log("Creating commit...");
  const commit = await createCommit(
    tree.sha,
    latestCommitSha,
    "chore(content): sync local nanobook content",
  );

  console.log("Updating branch reference...");
  await updateRef(commit.sha);

  console.log(`\nDone. Content pushed to:`);
  console.log(`https://github.com/${owner}/${REPO_NAME}/tree/${BRANCH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
