#!/usr/bin/env bash

# Colors
BOLD="\033[1m"
RESET="\033[0m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
GRAY="\033[90m"

# Ensure script is run from monorepo root where packages/ exists
if [ ! -d "./packages" ]; then
  echo -e "${RED}✖${RESET} ${BOLD}packages/ directory not found in current path${RESET}"
  echo -e "   ${GRAY}Run this script from the monorepo root.${RESET}"
  exit 1
fi

# Check if fzf is installed for interactive selection
if ! command -v fzf >/dev/null 2>&1; then
  echo -e "${RED}✖${RESET} ${BOLD}fzf is not installed${RESET}"
  echo -e "   ${GRAY}Install fzf to use interactive selection with arrows and space.${RESET}"
  echo -e "   ${GRAY}Example (macOS):${RESET} brew install fzf"
  echo -e "   ${GRAY}Example (Windows):${RESET} choco install fzf"
  exit 1
fi

# Collect package names from ./packages/*
PACKAGES=()
for dir in packages/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  PACKAGES+=("$name")
done

if [ ${#PACKAGES[@]} -eq 0 ]; then
  echo -e "${RED}✖${RESET} No packages found inside ${BOLD}packages/${RESET}"
  exit 1
fi

echo -e ""
echo -e "┌─────────────────────────────────────────────────────┐"
echo -e "│ ${BOLD}Select packages to build & publish to npm${RESET}       │"
echo -e "├─────────────────────────────────────────────────────┤"
echo -e "│ ${GRAY}Use arrows ↑↓ to navigate, SPACE to select, ENTER to confirm.${RESET}"
echo -e "└─────────────────────────────────────────────────────┘"
echo -e ""

# Feed package list to fzf for multi-selection
CHOICES=$(printf "%s\n" "${PACKAGES[@]}" | fzf \
  -m \
  --bind "space:toggle" \
  --prompt="Select packages > " \
  --header="Use arrows ↑↓, SPACE to toggle, ENTER to confirm")

# Handle cancel or empty selection
if [ -z "$CHOICES" ]; then
  echo -e "${YELLOW}▲${RESET} No packages selected. Aborting."
  exit 0
fi

echo -e ""
echo -e "┌─────────────────────────────────────────────────────┐"
echo -e "│ ${BOLD}Packages selected${RESET}                                 │"
echo -e "├─────────────────────────────────────────────────────┤"
while IFS= read -r pkg; do
  [ -n "$pkg" ] && echo -e "│ • ${CYAN}$pkg${RESET}"
done <<< "$CHOICES"
echo -e "└─────────────────────────────────────────────────────┘"
echo -e ""

# Ask for npm publish tag
echo -e "${BOLD}?${RESET} Enter npm publish tag ${GRAY}(default: latest)${RESET}"
read -p "> " NPMPUBLISH_TAG
if [ -z "$NPMPUBLISH_TAG" ]; then
  NPMPUBLISH_TAG="latest"
fi

# Ask for version strategy
echo -e ""
echo -e "${BOLD}?${RESET} Version strategy for all selected packages:"
echo -e "   ${CYAN}none${RESET}        → do not change version"
echo -e "   ${CYAN}patch${RESET}       → npm version patch"
echo -e "   ${CYAN}minor${RESET}       → npm version minor"
echo -e "   ${CYAN}major${RESET}       → npm version major"
echo -e "   ${CYAN}prerelease${RESET}  → npm version prerelease --preid=<preid>"
echo -e "   ${CYAN}custom${RESET}      → npm version <custom-version>"
echo -e "${GRAY}Press ENTER for 'none'.${RESET}"
read -p "> " VERSION_MODE

if [ -z "$VERSION_MODE" ]; then
  VERSION_MODE="none"
fi

PREID=""
CUSTOM_VERSION=""

case "$VERSION_MODE" in
  none)
    echo -e "${GRAY}→ Version will not be changed before publish.${RESET}"
    ;;
  patch|minor|major)
    echo -e "${GRAY}→ Using npm version $VERSION_MODE for each selected package.${RESET}"
    ;;
  prerelease)
    echo -e ""
    echo -e "${BOLD}?${RESET} Enter preid for prerelease (ex: ${CYAN}preview${RESET}, ${CYAN}preview.ab${RESET})"
    read -p "> " PREID
    if [ -z "$PREID" ]; then
      echo -e "${RED}✖${RESET} preid is required for prerelease."
      exit 1
    fi
    ;;
  custom)
    echo -e ""
    echo -e "${BOLD}?${RESET} Enter custom version (ex: ${CYAN}0.0.1-preview${RESET}, ${CYAN}0.0.1-preview.ab${RESET})"
    read -p "> " CUSTOM_VERSION
    if [ -z "$CUSTOM_VERSION" ]; then
      echo -e "${RED}✖${RESET} Custom version is required."
      exit 1
    fi
    ;;
  *)
    echo -e "${RED}✖${RESET} Invalid version mode: ${BOLD}$VERSION_MODE${RESET}"
    exit 1
    ;;
esac

echo -e ""
echo -e "┌─────────────────────────────────────────────────────┐"
echo -e "│ ${BOLD}Summary${RESET}                                            │"
echo -e "├─────────────────────────────────────────────────────┤"
echo -e "│ npm tag:      ${CYAN}$NPMPUBLISH_TAG${RESET}"
echo -e "│ version mode: ${YELLOW}$VERSION_MODE${RESET}"
if [ "$VERSION_MODE" = "prerelease" ]; then
  echo -e "│ preid:        ${CYAN}$PREID${RESET}"
fi
if [ "$VERSION_MODE" = "custom" ]; then
  echo -e "│ custom ver.:  ${CYAN}$CUSTOM_VERSION${RESET}"
fi
echo -e "│ packages:"
while IFS= read -r pkg; do
  [ -n "$pkg" ] && echo -e "│   • ${CYAN}$pkg${RESET}"
done <<< "$CHOICES"
echo -e "└─────────────────────────────────────────────────────┘"
echo -e ""

read -p "$(echo -e "${BOLD}?${RESET} Confirm build & publish for these packages? [y/N] ")" CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo -e "${YELLOW}▲${RESET} Operation cancelled."
  exit 0
fi

FAILED=0

# Process each selected package
while IFS= read -r pkg; do
  [ -n "$pkg" ] || continue
  TARGET="packages/$pkg"

  if [ ! -d "$TARGET" ]; then
    echo -e "${RED}✖${RESET} Directory not found: ${BOLD}$TARGET${RESET}"
    FAILED=1
    continue
  fi

  echo -e ""
  echo -e "┌──────────────────────────────────────────────┐"
  echo -e "│ ${BOLD}Processing package${RESET}: ${CYAN}$pkg${RESET}"
  echo -e "└──────────────────────────────────────────────┘"

  # Step 0: version bump if requested
  if [ "$VERSION_MODE" != "none" ]; then
    echo -e "${GRAY}→${RESET} Running ${BOLD}npm version${RESET} in ${GREEN}$TARGET${RESET}"
    echo -e "   ${GRAY}(using NPM_CONFIG_WORKSPACES_UPDATE=false to avoid workspaces update bug)${RESET}"

    if [ "$VERSION_MODE" = "prerelease" ]; then
      (
        cd "$TARGET" && \
        NPM_CONFIG_WORKSPACES_UPDATE=false \
        npm version prerelease \
          --preid="$PREID" \
          --no-git-tag-version
      )
      VERSION_EXIT=$?
    elif [ "$VERSION_MODE" = "custom" ]; then
      (
        cd "$TARGET" && \
        NPM_CONFIG_WORKSPACES_UPDATE=false \
        npm version "$CUSTOM_VERSION" \
          --no-git-tag-version
      )
      VERSION_EXIT=$?
    else
      (
        cd "$TARGET" && \
        NPM_CONFIG_WORKSPACES_UPDATE=false \
        npm version "$VERSION_MODE" \
          --no-git-tag-version
      )
      VERSION_EXIT=$?
    fi

    if [ $VERSION_EXIT -ne 0 ]; then
      echo -e "   ${RED}✖${RESET} npm version failed for ${CYAN}$pkg${RESET} ${GRAY}(exit $VERSION_EXIT)${RESET}"
      FAILED=1
      # Continue to next package, do not try build/publish
      continue
    else
      echo -e "   ${GREEN}✔${RESET} Version updated for ${CYAN}$pkg${RESET}"
    fi
  fi

  # Step 1: build with bun
  echo -e "${GRAY}→${RESET} Running ${BOLD}bun run build${RESET} in ${GREEN}$TARGET${RESET}"
  (cd "$TARGET" && bun run build)
  BUILD_EXIT=$?

  if [ $BUILD_EXIT -ne 0 ]; then
    echo -e "   ${RED}✖${RESET} Build failed for ${CYAN}$pkg${RESET} ${GRAY}(exit $BUILD_EXIT)${RESET}"
    FAILED=1
    # Skip publish if build fails
    continue
  else
    echo -e "   ${GREEN}✔${RESET} Build completed for ${CYAN}$pkg${RESET}"
  fi

  # Step 2: npm publish with tag
  echo -e "${GRAY}→${RESET} Running ${BOLD}npm publish --tag \"$NPMPUBLISH_TAG\"${RESET} in ${GREEN}$TARGET${RESET}"
  (cd "$TARGET" && npm publish --tag "$NPMPUBLISH_TAG")
  PUBLISH_EXIT=$?

  if [ $PUBLISH_EXIT -ne 0 ]; then
    echo -e "   ${RED}✖${RESET} npm publish failed for ${CYAN}$pkg${RESET} ${GRAY}(exit $PUBLISH_EXIT)${RESET}"
    FAILED=1
  else
    echo -e "   ${GREEN}✔${RESET} Published ${CYAN}$pkg${RESET} to npm with tag ${YELLOW}$NPMPUBLISH_TAG${RESET}"
  fi

done <<< "$CHOICES"

echo -e ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✔${RESET} ${BOLD}All selected packages built and published successfully${RESET}"
else
  echo -e "${YELLOW}▲${RESET} ${BOLD}Completed with some failures${RESET}"
fi

exit $FAILED