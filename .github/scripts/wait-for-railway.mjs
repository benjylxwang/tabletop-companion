#!/usr/bin/env node
// Poll Railway's GraphQL API until the frontend and api services both have a
// SUCCESS deployment for the given commit SHA, then emit their public URLs.
//
// Inputs (env):
//   RAILWAY_TOKEN     — account/team token with read access to the project
//   COMMIT_SHA        — commit SHA the PR is running on (GITHUB_SHA or PR head SHA)
//   GITHUB_OUTPUT     — set by GH Actions; we append key=value lines to it
//   TIMEOUT_MS        — optional, default 180000 (3 min)
//   REPO              — "<owner>/<repo>" used to match the Railway project to this repo
//
// Strategy:
// 1. `me { projects { edges { node { ... } } } }` — find the project whose GitHub
//    repo matches REPO. If exactly one project on the token, use that.
// 2. For each of its services named "frontend" and "api", list recent deployments
//    and find one whose meta.commitHash matches COMMIT_SHA with status SUCCESS.
// 3. Read each service's public domain (from `serviceInstance.domains` or the
//    deployment's `staticUrl`). Emit frontend_url / api_url to GITHUB_OUTPUT.
//
// This is deliberately the only CI-side Railway integration; no extra secrets
// (project id, service ids) are required, because the token scopes the lookup.

const TOKEN = process.env.RAILWAY_TOKEN;
const SHA = process.env.COMMIT_SHA;
const REPO = process.env.REPO;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 180_000);
const POLL_MS = 10_000;
const API = 'https://backboard.railway.app/graphql/v2';

if (!TOKEN || !SHA || !REPO) {
  console.error('missing required env: RAILWAY_TOKEN, COMMIT_SHA, REPO');
  process.exit(2);
}

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function findProjectId() {
  // Project tokens: pinned to a single project. Expose it via `projectToken`.
  // Account/team tokens: can query `me { projects }`. We try both so the
  // script works regardless of which kind RAILWAY_TOKEN is, without
  // introducing an extra secret.
  try {
    const data = await gql(`query { projectToken { projectId } }`);
    if (data?.projectToken?.projectId) return data.projectToken.projectId;
  } catch (err) {
    // Fall through — token isn't a project token.
  }

  const data = await gql(`
    query {
      me {
        projects {
          edges { node { id name } }
        }
      }
    }
  `);
  const projects = data.me.projects.edges.map((e) => e.node);
  if (projects.length === 0) throw new Error('No Railway projects on this token');

  const repoName = REPO.split('/')[1].toLowerCase();
  const byName = projects.find((p) => p.name.toLowerCase().includes(repoName));
  if (byName) return byName.id;
  if (projects.length === 1) return projects[0].id;
  throw new Error(
    `Cannot disambiguate project. Candidates: ${projects.map((p) => p.name).join(', ')}`,
  );
}

async function getServices(projectId) {
  const data = await gql(
    `
    query($id: String!) {
      project(id: $id) {
        services {
          edges {
            node {
              id
              name
              serviceInstances {
                edges { node { domains { serviceDomains { domain } } } }
              }
            }
          }
        }
      }
    }
  `,
    { id: projectId },
  );
  return data.project.services.edges.map((e) => e.node);
}

async function latestDeployment(projectId, serviceId) {
  const data = await gql(
    `
    query($projectId: String!, $serviceId: String!) {
      deployments(first: 20, input: { projectId: $projectId, serviceId: $serviceId }) {
        edges {
          node {
            id
            status
            staticUrl
            url
            meta
          }
        }
      }
    }
  `,
    { projectId, serviceId },
  );
  return data.deployments.edges.map((e) => e.node);
}

function pickUrl(svc, deployment) {
  // Prefer the deployment's static/url, else the service's configured domain.
  if (deployment?.staticUrl) return `https://${deployment.staticUrl}`;
  if (deployment?.url) return deployment.url.startsWith('http') ? deployment.url : `https://${deployment.url}`;
  const domain = svc.serviceInstances?.edges?.[0]?.node?.domains?.serviceDomains?.[0]?.domain;
  if (domain) return `https://${domain}`;
  return null;
}

function matches(dep) {
  const hash = dep.meta?.commitHash ?? dep.meta?.commit?.hash;
  return hash && hash.startsWith(SHA.slice(0, 7));
}

function setOutput(key, value) {
  const line = `${key}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) {
    require('node:fs').appendFileSync(process.env.GITHUB_OUTPUT, line);
  }
  console.log(line.trim());
}

async function main() {
  const projectId = await findProjectId();
  console.log(`project=${projectId}`);
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const services = await getServices(projectId);
    const fe = services.find((s) => s.name.toLowerCase() === 'frontend');
    const api = services.find((s) => s.name.toLowerCase() === 'api');
    if (!fe || !api) {
      throw new Error(
        `Expected services named "frontend" and "api"; got: ${services.map((s) => s.name).join(', ')}`,
      );
    }

    const [feDeploys, apiDeploys] = await Promise.all([
      latestDeployment(projectId, fe.id),
      latestDeployment(projectId, api.id),
    ]);

    const feMatch = feDeploys.find((d) => matches(d) && d.status === 'SUCCESS');
    const apiMatch = apiDeploys.find((d) => matches(d) && d.status === 'SUCCESS');

    const feAny = feDeploys.find(matches);
    const apiAny = apiDeploys.find(matches);

    if ([feAny, apiAny].some((d) => d?.status === 'FAILED' || d?.status === 'CRASHED')) {
      throw new Error(
        `Railway deployment failed: frontend=${feAny?.status}, api=${apiAny?.status}`,
      );
    }

    console.log(
      `status: frontend=${feAny?.status ?? 'pending'}, api=${apiAny?.status ?? 'pending'}`,
    );

    if (feMatch && apiMatch) {
      const frontendUrl = pickUrl(fe, feMatch);
      const apiUrl = pickUrl(api, apiMatch);
      if (!frontendUrl || !apiUrl) {
        throw new Error(`Deployments ready but missing URLs: frontend=${frontendUrl}, api=${apiUrl}`);
      }
      setOutput('frontend_url', frontendUrl);
      setOutput('api_url', apiUrl);
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error(`Timed out after ${TIMEOUT_MS}ms waiting for Railway deployments of ${SHA}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
