// Builds dist/DeskbeeHelper-v<version>.zip (only what Chrome needs) and dist/RELEASE_NOTES.md.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const INCLUDE = [
  "manifest.json",
  "content.js",
  "page-hook.js",
  "background",
  "config",
  "lib",
  "options",
  "popup",
  "styles",
  "icons",
  "README.md",
  "LICENSE",
  "changelog.md",
];

const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const zipName = `DeskbeeHelper-v${version}.zip`;
const zip = `dist/${zipName}`;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
execFileSync("zip", ["-r", "-q", "-X", zip, ...INCLUDE, "-x", "*.DS_Store"], { stdio: "inherit" });

// Release notes = changelog section of this version
const changelog = readFileSync("changelog.md", "utf8");
const start = changelog.indexOf(`# Version ${version}`);
if (start === -1) throw new Error(`No changelog entry for ${version}`);
const rest = changelog.slice(start).split("\n").slice(1);
const end = rest.findIndex((l) => l.startsWith("# Version "));
const notes = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
writeFileSync(
  "dist/RELEASE_NOTES.md",
  `${notes}\n\n## Install\n\n1. Download \`${zipName}\` and unzip it.\n2. Open \`chrome://extensions\`, enable Developer mode.\n3. Click **Load unpacked** and select the unzipped folder.\n`,
);

console.log(`Built ${zip}`);
