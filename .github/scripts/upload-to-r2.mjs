#!/usr/bin/env node
// Upload the Playwright HTML report and all recorded .webm videos to Cloudflare R2
// so they can be linked directly from a PR comment (no zip download, no login).
//
// Inputs (env):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL_BASE
//   PR_NUMBER, RUN_ID, GITHUB_OUTPUT
//
// Outputs (appended to $GITHUB_OUTPUT):
//   report_url       — public URL of the report's index.html
//   videos_markdown  — markdown bullet list of (test name → video URL)

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL_BASE,
  PR_NUMBER,
  RUN_ID,
  GITHUB_OUTPUT,
} = process.env;

for (const [k, v] of Object.entries({
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL_BASE, PR_NUMBER, RUN_ID,
})) {
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(2);
  }
}

const ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const PREFIX = `pr-${PR_NUMBER}/run-${RUN_ID}`;
const PUBLIC_BASE = R2_PUBLIC_URL_BASE.replace(/\/$/, '');

const awsEnv = {
  ...process.env,
  AWS_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
  AWS_DEFAULT_REGION: 'auto',
  // Cloudflare R2 rejects the newer integrity header Boto/aws-cli sends by default.
  AWS_REQUEST_CHECKSUM_CALCULATION: 'WHEN_REQUIRED',
  AWS_RESPONSE_CHECKSUM_VALIDATION: 'WHEN_REQUIRED',
};

async function aws(args) {
  return execFileP('aws', [...args, '--endpoint-url', ENDPOINT], { env: awsEnv });
}

function appendOutput(key, value) {
  const isMultiline = value.includes('\n');
  const line = isMultiline
    ? `${key}<<__EOF__\n${value}\n__EOF__\n`
    : `${key}=${value}\n`;
  fs.appendFileSync(GITHUB_OUTPUT, line);
  console.log(isMultiline ? `${key}=<multi-line>` : line.trim());
}

async function uploadReport() {
  const dir = 'e2e/playwright-report';
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    console.warn(`No report at ${dir}/index.html — skipping`);
    appendOutput('report_url', '');
    return;
  }
  await aws(['s3', 'cp', '--recursive', dir, `s3://${R2_BUCKET}/${PREFIX}/report/`]);
  appendOutput('report_url', `${PUBLIC_BASE}/${PREFIX}/report/index.html`);
}

function findVideos(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.webm')) out.push(p);
    }
  };
  walk(root);
  return out;
}

// Playwright writes `e2e/test-results/<spec>-<test>-<project>[-retry<N>]/video.webm`.
// Use the parent-dir name (which encodes all that) as the slug.
function slugForVideo(file) {
  const parent = path.basename(path.dirname(file));
  return parent.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

// Human-readable label recovered from the slug (underscores/hyphens → spaces, trim).
function labelForSlug(slug) {
  return slug
    .replace(/-chromium(-retry\d+)?$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

async function uploadVideos() {
  const files = findVideos('e2e/test-results');
  if (files.length === 0) {
    appendOutput('videos_markdown', '_no videos recorded_');
    return;
  }
  const results = await Promise.all(
    files.map(async (file) => {
      const slug = slugForVideo(file);
      const key = `${PREFIX}/videos/${slug}.webm`;
      await aws(['s3', 'cp', file, `s3://${R2_BUCKET}/${key}`, '--content-type', 'video/webm']);
      return { slug, url: `${PUBLIC_BASE}/${key}` };
    }),
  );
  const md = results
    .map(({ slug, url }) => `- [${labelForSlug(slug)}](${url})`)
    .join('\n');
  appendOutput('videos_markdown', md);
}

try {
  await uploadReport();
  await uploadVideos();
} catch (err) {
  console.error(err.stderr ?? err.message ?? err);
  process.exit(1);
}
