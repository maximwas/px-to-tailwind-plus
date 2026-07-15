// Bumps the version, adds a changelog stub, commits, tags and pushes.
// Usage: npm run release -- <patch|minor|major>   (default: patch)
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const bump = process.argv[2] ?? "patch";
if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Invalid bump "${bump}" — use patch, minor or major.`);
  process.exit(1);
}

const run = (command) => execSync(command, { stdio: "inherit" });
const capture = (command) => execSync(command).toString().trim();

// Refuse to release from a dirty tree.
if (capture("git status --porcelain")) {
  console.error("Working tree is not clean. Commit or stash changes first.");
  process.exit(1);
}

run(`pnpm version ${bump} --no-git-tag-version`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const date = new Date().toISOString().slice(0, 10);

// Insert a changelog section above the first existing release entry.
const changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes(`## [${version}]`)) {
  const entry = `## [${version}] - ${date}\n\n- _Describe the changes in this release._\n\n`;
  const firstEntry = changelog.indexOf("\n## [");
  const updated =
    firstEntry === -1
      ? `${changelog}\n${entry}`
      : changelog.slice(0, firstEntry + 1) + entry + changelog.slice(firstEntry + 1);
  writeFileSync("CHANGELOG.md", updated);
}

run("git add package.json pnpm-lock.yaml CHANGELOG.md");
run(`git commit -m "chore(release): v${version}"`);
run(`git tag v${version}`);
run("git push --follow-tags");

console.log(`\nReleased v${version}. The release workflow will publish it.`);
