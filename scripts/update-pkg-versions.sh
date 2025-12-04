#!/usr/bin/env bash

set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: $(basename "$0") [version]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Discover all package.json files inside packages/* (the publishable libs).
LIB_PACKAGE_FILES=()
for pkg_json in "$ROOT_DIR"/packages/*/package.json; do
  [[ -f "$pkg_json" ]] && LIB_PACKAGE_FILES+=("$pkg_json")
done

if [[ ${#LIB_PACKAGE_FILES[@]} -eq 0 ]]; then
  echo "No package.json files found under packages/. Nothing to update." >&2
  exit 0
fi

# Resolve the name for each library package so we know what to bump everywhere else.
LIB_NAMES=()
for pkg_json in "${LIB_PACKAGE_FILES[@]}"; do
  name="$(node -p "const pkg=require(process.argv[1]); pkg?.name ?? ''" "$pkg_json")"
  if [[ -z "$name" ]]; then
    echo "Skipping $pkg_json because it does not declare a package name." >&2
    continue
  fi
  LIB_NAMES+=("$name")
done

if [[ ${#LIB_NAMES[@]} -eq 0 ]]; then
  echo "Could not discover any package names to update." >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  VERSION="$1"
  if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid version \"$VERSION\". Use the format X.Y.Z (e.g. 0.0.8)." >&2
    exit 1
  fi
else
  if [[ -z "${LIB_NAMES[0]:-}" ]]; then
    echo "Unable to determine a package to query for the latest version." >&2
    exit 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to auto-detect the latest version. Please install npm or pass a version explicitly." >&2
    exit 1
  fi
  VERSION="$(npm view "${LIB_NAMES[0]}" version 2>/dev/null || true)"
  if [[ -z "$VERSION" ]]; then
    echo "Failed to retrieve the latest version for ${LIB_NAMES[0]} from npm. Pass a version explicitly." >&2
    exit 1
  fi
  if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Registry returned an invalid semver \"$VERSION\". Pass a version explicitly." >&2
    exit 1
  fi
  echo "Auto-detected latest published version: $VERSION"
fi

# Collect every package.json in the repo so dependency fields stay in sync.
mapfile -d '' -t ALL_PACKAGE_JSONS < <(find "$ROOT_DIR" -name package.json -not -path "*/node_modules/*" -print0)

node - "$VERSION" -- "${LIB_NAMES[@]}" -- "${ALL_PACKAGE_JSONS[@]}" <<'NODE'
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const version = args.shift();
if (!version) {
  console.error("Missing version argument.");
  process.exit(1);
}

if (args.shift() !== "--") {
  console.error("Internal argument parsing error (expected -- before package names).");
  process.exit(1);
}

const targetNames = new Set();
while (args.length && args[0] !== "--") {
  targetNames.add(args.shift());
}

if (!targetNames.size) {
  console.error("No target package names supplied.");
  process.exit(1);
}

if (args.shift() !== "--") {
  console.error("Internal argument parsing error (expected -- before file list).");
  process.exit(1);
}

const files = args;
const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "catalog"];
const updatedFiles = [];
const peerFixes = [];

function nextRange(value, version) {
  if (typeof value !== "string" || !value.length) {
    return version;
  }
  const prefix = value[0] === "^" || value[0] === "~" ? value[0] : "";
  return `${prefix}${version}`;
}

for (const file of files) {
  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  let json;
  try {
    json = JSON.parse(source);
  } catch {
    console.warn(`Skipping ${file} (invalid JSON).`);
    continue;
  }

  let changed = false;
  const pkgName = json.name;

  if (pkgName && targetNames.has(pkgName) && json.version !== version) {
    json.version = version;
    changed = true;
  }

  for (const section of sections) {
    const block = json[section];
    if (!block || typeof block !== "object") continue;

    for (const depName of targetNames) {
      const current = block[depName];
      if (!current) continue;

      const updated = nextRange(current, version);
      if (current !== updated) {
        block[depName] = updated;
        changed = true;
        if (section === "peerDependencies") {
          peerFixes.push(`${pkgName ?? path.relative(process.cwd(), file)} -> ${depName}: ${current} -> ${updated}`);
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
    updatedFiles.push(path.relative(process.cwd(), file));
  }
}

console.log(`Updated package versions and dependency references in ${updatedFiles.length} package.json file(s) to ${version}.`);
if (updatedFiles.length) {
  updatedFiles.forEach((file) => console.log(` - ${file}`));
}

if (peerFixes.length) {
  console.log("\nPeer dependency adjustments:");
  peerFixes.forEach((msg) => console.log(` - ${msg}`));
} else {
  console.log("\nNo peer dependency mismatches detected.");
}
NODE

echo "Done."
