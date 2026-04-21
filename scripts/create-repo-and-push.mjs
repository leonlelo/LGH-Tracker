/**
 * Oppretter et nytt GitHub-repo under din bruker og pusher main.
 *
 * Bruk:
 *   set GITHUB_TOKEN=ghp_ditt_personlige_token
 *   node scripts/create-repo-and-push.mjs
 *
 * Token: https://github.com/settings/tokens (classic: minst scope "repo")
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const token = process.env.GITHUB_TOKEN?.trim();
const repoName = process.argv[2] || "nff-tracker";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!token) {
  console.error("Mangler GITHUB_TOKEN. Sett miljøvariabel og kjør på nytt.");
  process.exit(1);
}

function gh(method, url, body) {
  return fetch(url, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  const meRes = await gh("GET", "https://api.github.com/user");
  if (!meRes.ok) {
    console.error("Kunne ikke hente bruker:", meRes.status, await meRes.text());
    process.exit(1);
  }
  const { login } = await meRes.json();
  console.log("GitHub-bruker:", login);

  const createRes = await gh("POST", "https://api.github.com/user/repos", {
    name: repoName,
    private: false,
    auto_init: false,
    description: "LHG fotballstatistikk",
  });

  if (createRes.status === 422) {
    console.log("Repo finnes fra før – fortsetter med push.");
  } else if (!createRes.ok) {
    console.error("Kunne ikke opprette repo:", createRes.status, await createRes.text());
    process.exit(1);
  } else {
    console.log("Repo opprettet:", `https://github.com/${login}/${repoName}`);
  }

  const remote = `https://${token}@github.com/${login}/${repoName}.git`;

  process.chdir(root);

  try {
    execSync("git remote get-url origin", { stdio: "pipe" });
    execSync("git remote remove origin", { stdio: "inherit" });
  } catch {
    /* ingen origin */
  }

  execSync(`git remote add origin "${remote}"`, { stdio: "inherit" });
  execSync("git branch -M main", { stdio: "inherit" });
  execSync("git push -u origin main", { stdio: "inherit" });

  execSync("git remote remove origin", { stdio: "inherit" });
  execSync(`git remote add origin https://github.com/${login}/${repoName}.git`, {
    stdio: "inherit",
  });

  console.log("\nFerdig. Remote er satt til (uten token i URL):");
  console.log(`  https://github.com/${login}/${repoName}.git`);
  console.log("Push neste gang med vanlig git push (Git Credential Manager / SSH).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
