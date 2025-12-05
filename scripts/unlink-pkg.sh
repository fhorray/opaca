#!/usr/bin/env bash

# Colors
BOLD="\033[1m"
RESET="\033[0m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
GRAY="\033[90m"

# Ensure at least one arg was provided
if [ $# -lt 1 ]; then
  echo -e "${RED}✖${RESET} ${BOLD}Invalid usage${RESET}"
  echo -e "   ${GRAY}usage:${RESET} bun run wkunlink ${CYAN}<package...>${RESET}"
  echo -e "   ${GRAY}example:${RESET} bun run wkunlink core router"
  echo -e "   ${GRAY}all packages:${RESET} bun run wkunlink '*'"
  exit 1
fi

PACKAGES=()

# If user used "*" as the only argument, resolve all packages under ./packages
if [ "$1" = "*" ] && [ $# -eq 1 ]; then
  # Collect all package directories inside ./packages
  for dir in packages/*/; do
    # Skip if no directories found
    [ -d "$dir" ] || continue
    PACKAGES+=("$(basename "$dir")")
  done

  if [ ${#PACKAGES[@]} -eq 0 ]; then
    echo -e "${RED}✖${RESET} No packages found in ${BOLD}packages/${RESET}"
    exit 1
  fi
else
  # Use provided arguments as package names
  PACKAGES=("$@")
fi

echo -e ""
echo -e "┌──────────────────────────────────────────────┐"
echo -e "│ ${BOLD}wkunlink – bun unlink in packages${RESET}          │"
echo -e "├──────────────────────────────────────────────┤"
echo -e "│ Target packages:${RESET}"
for pkg in "${PACKAGES[@]}"; do
  echo -e "│   • ${CYAN}$pkg${RESET}"
done
echo -e "└──────────────────────────────────────────────┘"
echo -e ""

FAILED=0

for pkg in "${PACKAGES[@]}"; do
  TARGET_PATH="./packages/$pkg"

  # Check if package directory exists
  if [ ! -d "$TARGET_PATH" ]; then
    echo -e "${RED}✖${RESET} Package directory not found: ${BOLD}$TARGET_PATH${RESET}"
    FAILED=1
    continue
  fi

  echo -e "${GRAY}→${RESET} Running ${BOLD}bun unlink${RESET} in ${GREEN}$TARGET_PATH${RESET}"
  bun unlink --cwd "$TARGET_PATH"
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo -e "   ${GREEN}✔${RESET} Unlinked ${CYAN}$pkg${RESET}"
  else
    echo -e "   ${RED}✖${RESET} Failed to unlink ${CYAN}$pkg${RESET} ${GRAY}(exit code: $EXIT_CODE)${RESET}"
    FAILED=1
  fi

  echo ""
done

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✔${RESET} ${BOLD}All unlinks completed successfully${RESET}"
else
  echo -e "${YELLOW}▲${RESET} ${BOLD}Completed with some failures${RESET}"
fi

exit $FAILED