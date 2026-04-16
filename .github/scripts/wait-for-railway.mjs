#!/usr/bin/env node
import fs from 'node:fs';
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
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const SHA = process.env.COMMIT_SHA;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 180_000);
const POLL_MS = 10_000;
const API = 'https://backboard.railway.app/graphql/v2';

if (!TOKEN || !SHA || !PROJECT_ID) {
  console.error('missing required env: RAILWAY_TOKEN, RAILWAY_PROJECT_ID, COMMIT_SHA');
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

// Project ID is supplied explicitly via RAILWAY_PROJECT_ID. We tried
// auto-discovering via `me`/`projectToken` queries, but Railway tokens with
// narrow scopes reject those. Explicit is simpler and works for every token
// type.

async function getProject(projectId) {
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
        environments {
          edges { node { id name } }
        }
      }
    }
  `,
    { id: projectId },
  );
  return {
    services: data.project.services.edges.map((e) => e.node),
    environments: data.project.environments.edges.map((e) => e.node),
  };
}

// The "main" environment is the one deploys land on for pushes to main.
// Railway's convention is a single environment named "production"; we match it
// case-insensitively and fall back to the first environment if none is named.
function pickProductionEnvironmentId(environments) {
  const byName = environments.find((e) => e.name.toLowerCase() === 'production');
  if (byName) return byName.id;
  if (environments.length === 1) return environments[0].id;
  throw new Error(
    `Cannot identify production environment; got: ${environments.map((e) => e.name).join(', ')}`,
  );
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
            environmentId
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
    fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  }
  console.log(line.trim());
}

async function main() {
  const projectId = PROJECT_ID;
  console.log(`project=${projectId}`);
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { services, environments } = await getProject(projectId);
    const productionEnvironmentId = pickProductionEnvironmentId(environments);
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

    // Prefer a deployment matching THIS commit SHA. If a SHA-matching
    // deployment exists but is still BUILDING/DEPLOYING, keep polling —
    // falling back to a stale prod deployment in that window was the bug
    // that let PR #46 test against prod while its preview was still building.
    //
    // Only fall back to "most recent SUCCESS" when Railway has SKIPPED this
    // SHA entirely (watched paths unchanged) — and in that case the fallback
    // MUST be constrained to the production environment. An unconstrained
    // fallback happily picks another PR's preview (whose app shell is
    // unrelated to this PR's tests), which is how #50's run against #49's
    // frontend red-lit CI.
    const pickReady = (deploys) => {
      const shaMatched = deploys.find(matches);
      if (shaMatched) {
        return shaMatched.status === 'SUCCESS' ? shaMatched : null;
      }
      return deploys.find(
        (d) => d.status === 'SUCCESS' && d.environmentId === productionEnvironmentId,
      );
    };

    const feMatch = pickReady(feDeploys);
    const apiMatch = pickReady(apiDeploys);

    const feAny = feDeploys.find(matches) ?? feDeploys[0];
    const apiAny = apiDeploys.find(matches) ?? apiDeploys[0];

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
