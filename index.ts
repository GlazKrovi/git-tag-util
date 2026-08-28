import { $ } from "bun";

type Bump = "patch" | "minor" | "major";

const TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:-.+)?$/;

async function getLatestTag(): Promise<string | null> {
  const output = await $`git tag -l --sort=-v:refname`.quiet().text();
  const tags = output.split("\n").map((t) => t.trim()).filter(Boolean);
  return tags.find((t) => TAG_PATTERN.test(t)) ?? null;
}

function parseVersion(tag: string): [number, number, number] {
  const match = TAG_PATTERN.exec(tag);
  if (!match) {
    throw new Error(`Tag "${tag}" doesn't match vX.Y.Z or vX.Y.Z-suffix`);
  }
  const [, major, minor, patch] = match;
  return [Number(major), Number(minor), Number(patch)];
}

function bumpVersion(
  [major, minor, patch]: [number, number, number],
  kind: Bump,
): [number, number, number] {
  switch (kind) {
    case "major":
      return [major + 1, 0, 0];
    case "minor":
      return [major, minor + 1, 0];
    case "patch":
      return [major, minor, patch + 1];
  }
}

async function createTag(kind: Bump) {
  const latest = await getLatestTag();
  const current = latest ? parseVersion(latest) : [0, 0, 0] as [number, number, number];
  const [major, minor, patch] = bumpVersion(current, kind);
  const newTag = `v${major}.${minor}.${patch}`;

  console.log(latest ? `Latest tag: ${latest}` : "No existing vX.Y.Z tag found, starting from v0.0.0");
  console.log(`Creating tag: ${newTag}`);

  await $`git tag -a ${newTag} -m ${newTag}`.quiet();

  const commit = (await $`git rev-parse --short HEAD`.quiet().text()).trim();
  console.log(`Tag ${newTag} created on commit ${commit}.`);
  console.log(`Run "bun run push" to publish it (git push --tags).`);
}

async function pushTags() {
  console.log("Pushing tags to origin...");
  await $`git push --tags`;
}

async function main() {
  const arg = process.argv[2];

  switch (arg) {
    case "patch":
    case "minor":
    case "major":
      await createTag(arg);
      break;
    case "push":
      await pushTags();
      break;
    default:
      console.error(`Usage: bun run <patch|minor|major|push>`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
