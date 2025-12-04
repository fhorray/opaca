#!/usr/bin/env bash
# Workspace cleaner script
#
# This script scans the current project for common build / cache folders
# and deletes them in bulk (e.g. node_modules, dist, .turbo, .opaca).
#
# Usage:
#   bun run wkclean [options] <target...>
#
# Targets:
#   node_modules   Remove all "node_modules" folders
#   dist           Remove all "dist" folders
#   .turbo         Remove all ".turbo" folders
#   .opaca          Remove all ".opaca" folders
#   all            Shortcut for: node_modules, dist, .turbo, .opaca
#
# Options:
#   -y, --yes      Do not ask for confirmation (non-interactive mode)
#   -n, --dry-run  Show what would be deleted, but do not remove anything
#   -h, --help     Print this help message and exit
#
# Examples:
#   # Delete all node_modules and dist folders (with confirmation)
#   bun run wkclean node_modules dist
#
#   # Delete everything without confirmation
#   bun run wkclean all --yes
#
#   # Preview what would be deleted (no changes)
#   bun run wkclean node_modules .turbo --dry-run


# Colors
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
GRAY="\033[90m"

SCRIPT_NAME=$(basename "$0")

KNOWN_TARGETS=("node_modules" "dist" ".turbo" ".opaca" ".wrangler")

YES=0
DRY_RUN=0
REQUESTED_TARGETS=()

print_usage() {
  echo -e "${BOLD}Usage:${RESET} $SCRIPT_NAME [options] <target...>"
  echo ""
  echo -e "  ${BOLD}Targets:${RESET}"
  echo -e "    ${YELLOW}node_modules${RESET}  - Remove all 'node_modules' directories"
  echo -e "    ${YELLOW}dist${RESET}          - Remove all 'dist' directories"
  echo -e "    ${YELLOW}.turbo${RESET}        - Remove all '.turbo' directories"
  echo -e "    ${YELLOW}.opaca${RESET}         - Remove all '.opaca' directories"
  echo -e "    ${YELLOW}all${RESET}           - All of the above"
  echo ""
  echo -e "  ${BOLD}Options:${RESET}"
  echo -e "    ${CYAN}--yes, -y${RESET}      - Do not ask for confirmation"
  echo -e "    ${CYAN}--dry-run, -n${RESET}  - Only show what would be deleted"
  echo -e "    ${CYAN}--help, -h${RESET}     - Show this help"
  echo ""
  echo -e "  ${BOLD}Examples:${RESET}"
  echo -e "    $SCRIPT_NAME node_modules dist"
  echo -e "    $SCRIPT_NAME all --yes"
  echo -e "    $SCRIPT_NAME node_modules .turbo --dry-run"
}

is_known_target() {
  local target="$1"
  for t in "${KNOWN_TARGETS[@]}"; do
    if [ "$t" = "$target" ]; then
      return 0
    fi
  done
  return 1
}

dedupe_targets() {
  local input=("$@")
  local unique=()
  for t in "${input[@]}"; do
    local found=0
    for u in "${unique[@]}"; do
      if [ "$u" = "$t" ]; then
        found=1
        break
      fi
    done
    if [ $found -eq 0 ]; then
      unique+=("$t")
    fi
  done
  echo "${unique[@]}"
}

find_paths_for_target() {
  local target="$1"
  case "$target" in
    node_modules)
      # Avoid descending into node_modules again
      find . -type d -name "node_modules" -prune 2>/dev/null
      ;;
    dist)
      find . -type d -name "dist" -prune 2>/dev/null
      ;;
    .turbo)
      find . -type d -name ".turbo" -prune 2>/dev/null
      ;;
    .opaca)
      find . -type d -name ".opaca" -prune 2>/dev/null
      ;;
    *)
      return 1
      ;;
  esac
}

# Parse args
if [ $# -eq 0 ]; then
  echo -e "${RED}✖${RESET} ${BOLD}No targets provided${RESET}"
  echo ""
  print_usage
  exit 1
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)
      YES=1
      shift
      ;;
    --dry-run|-n)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    all)
      REQUESTED_TARGETS+=("${KNOWN_TARGETS[@]}")
      shift
      ;;
    *)
      REQUESTED_TARGETS+=("$1")
      shift
      ;;
  esac
done

# Deduplicate targets
REQUESTED_TARGETS=($(dedupe_targets "${REQUESTED_TARGETS[@]}"))

# Validate targets
for t in "${REQUESTED_TARGETS[@]}"; do
  if ! is_known_target "$t"; then
    echo -e "${RED}✖${RESET} ${BOLD}Unknown target:${RESET} $t"
    echo ""
    print_usage
    exit 1
  fi
done

# Scan project for matches
ALL_PATHS=()
echo -e ""
echo -e "┌──────────────────────────────────────────────┐"
echo -e "│ ${BOLD}Workspace cleaner${RESET}                            │"
echo -e "├──────────────────────────────────────────────┤"
echo -e "│ Root:   ${GREEN}$(pwd)${RESET}"
echo -e "│ Targets:${YELLOW} ${REQUESTED_TARGETS[*]}${RESET}"
echo -e "└──────────────────────────────────────────────┘"
echo -e ""

for t in "${REQUESTED_TARGETS[@]}"; do
  echo -e "${DIM}Searching for${RESET} ${YELLOW}$t${RESET} ..."
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    ALL_PATHS+=("$path")
  done < <(find_paths_for_target "$t")
done

if [ "${#ALL_PATHS[@]}" -eq 0 ]; then
  echo -e "${YELLOW}⚠${RESET} No matching paths found for selected targets."
  exit 0
fi

# Summary
echo -e ""
echo -e "┌──────────────────────────────────────────────┐"
echo -e "│ ${BOLD}Deletion summary${RESET}                             │"
echo -e "├──────────────────────────────────────────────┤"
echo -e "│ Total paths: ${CYAN}${#ALL_PATHS[@]}${RESET}"
echo -e "│ Targets:     ${YELLOW}${REQUESTED_TARGETS[*]}${RESET}"
echo -e "├──────────────────────────────────────────────┤"

MAX_PREVIEW=10
COUNT=0
for p in "${ALL_PATHS[@]}"; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -le $MAX_PREVIEW ]; then
    echo -e "│ - ${GREEN}$p${RESET}"
  fi
done

if [ "${#ALL_PATHS[@]}" -gt $MAX_PREVIEW ]; then
  echo -e "│ ${GRAY}... and $((${#ALL_PATHS[@]} - MAX_PREVIEW)) more${RESET}"
fi

echo -e "└──────────────────────────────────────────────┘"
echo -e ""

# Confirmation
if [ $DRY_RUN -eq 1 ]; then
  echo -e "${YELLOW}Dry run:${RESET} nothing will be deleted."
elif [ $YES -eq 0 ]; then
  echo -ne "${BOLD}?${RESET} Proceed to delete these paths? ${GRAY}(y/N)${RESET}: "
  read CONFIRM
  case "$CONFIRM" in
    y|Y|yes|YES)
      ;;
    *)
      echo -e "${RED}✖${RESET} Aborted by user."
      exit 1
      ;;
  esac
fi

# Deletion step
echo -e ""
if [ $DRY_RUN -eq 1 ]; then
  echo -e "${BOLD}Paths that would be removed:${RESET}"
  for p in "${ALL_PATHS[@]}"; do
    echo -e "  ${GRAY}- $p${RESET}"
  done
  echo -e ""
  echo -e "${GREEN}✔${RESET} ${BOLD}Dry run completed${RESET}"
  exit 0
fi

for p in "${ALL_PATHS[@]}"; do
  echo -e "${DIM}Removing${RESET} ${GREEN}$p${RESET}"
  rm -rf "$p"
done

echo -e ""
echo -e "${GREEN}✔${RESET} ${BOLD}Cleanup completed${RESET}"
