// Static checks run in CI: syntax, manifest integrity, version consistency.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const errors = [];
const fail = (msg) => errors.push(msg);

// 1. Syntax of every extension JS file
const SRC_DIRS = ["background", "config", "lib", "options", "popup"];
const files = ["content.js", "page-hook.js"];
for (const dir of SRC_DIRS) {
  for (const f of readdirSync(dir)) if (f.endsWith(".js")) files.push(join(dir, f));
}
for (const f of files) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    fail(`Syntax error in ${f}:\n${e.stderr}`);
  }
}

// 2. Manifest references existing files
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const referenced = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons || {}),
  ...(manifest.content_scripts || []).flatMap((c) => c.js || []),
].filter(Boolean);
for (const f of referenced) if (!existsSync(f) || !statSync(f).isFile()) fail(`manifest.json references missing file: ${f}`);

// 3. Every CSS @import resolves to an existing file
import { dirname } from "node:path";
for (const dir of ["popup", "options", "styles"]) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".css"))) {
    const file = join(dir, f);
    for (const m of readFileSync(file, "utf8").matchAll(/@import url\("([^"]+)"\)/g)) {
      const target = join(dirname(file), m[1]);
      if (!existsSync(target)) fail(`${file} imports missing ${m[1]}`);
    }
  }
}

// 4. Version consistency (manifest <-> changelog, and tag on release)
const version = manifest.version;
const changelogTop = readFileSync("changelog.md", "utf8").match(/^# Version (\S+)/m)?.[1];
if (changelogTop !== version) fail(`changelog.md top entry is ${changelogTop}, manifest is ${version}`);

const tag = process.env.RELEASE_TAG;
if (tag && tag !== `v${version}`) fail(`Tag ${tag} does not match manifest version v${version}`);

if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}
console.log(`OK: ${files.length} files, ${referenced.length} manifest refs, version ${version}`);
