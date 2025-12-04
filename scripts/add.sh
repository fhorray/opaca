#!/usr/bin/env bash

# Colors
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
GRAY="\033[90m"

PKG_NAME=$1
shift
LIBS=$@

if [ -z "$PKG_NAME" ] || [ -z "$LIBS" ]; then
  echo -e "${RED}✖${RESET} ${BOLD}Invalid usage${RESET}"
  echo -e "   ${GRAY}usage:${RESET} bun add ${CYAN}<workspace>${RESET} ${YELLOW}<lib...>${RESET}"
  echo -e "   ${GRAY}example:${RESET} bun add core zod nanostores"
  exit 1
fi

PACKAGE_PATH="./packages/$PKG_NAME"
APP_PATH="./apps/$PKG_NAME"
TARGET_PATH=""

if [ -d "$PACKAGE_PATH" ] && [ -d "$APP_PATH" ]; then
  echo -e ""
  echo -e "┌──────────────────────────────────────────────┐"
  echo -e "│ ${BOLD}Workspace selector${RESET}                             │"
  echo -e "├──────────────────────────────────────────────┤"
  echo -e "│ Name:   ${CYAN}$PKG_NAME${RESET}"
  echo -e "│ Libs:   ${YELLOW}$LIBS${RESET}"
  echo -e "├──────────────────────────────────────────────┤"
  echo -e "│ 1) ${GREEN}$PACKAGE_PATH${RESET}"
  echo -e "│ 2) ${GREEN}$APP_PATH${RESET}"
  echo -e "└──────────────────────────────────────────────┘"
  echo -ne "${BOLD}?${RESET} Choose target ${GRAY}(1 or 2)${RESET}: "
  read CHOICE

  if [ "$CHOICE" = "1" ]; then
    TARGET_PATH="$PACKAGE_PATH"
  elif [ "$CHOICE" = "2" ]; then
    TARGET_PATH="$APP_PATH"
  else
    echo -e "${RED}✖${RESET} Invalid choice."
    exit 1
  fi
elif [ -d "$PACKAGE_PATH" ]; then
  TARGET_PATH="$PACKAGE_PATH"
elif [ -d "$APP_PATH" ]; then
  TARGET_PATH="$APP_PATH"
else
  echo -e "${RED}✖${RESET} Workspace not found: ${BOLD}$PKG_NAME${RESET}"
  echo -e "   ${GRAY}searched in:${RESET} ${GREEN}packages/${RESET} and ${GREEN}apps/${RESET}"
  exit 1
fi

echo -e ""
echo -e "┌──────────────────────────────────────────────┐"
echo -e "│ ${BOLD}bun add${RESET}                                      │"
echo -e "├──────────────────────────────────────────────┤"
echo -e "│ Workspace: ${CYAN}$PKG_NAME${RESET}"
echo -e "│ Path:      ${GREEN}$TARGET_PATH${RESET}"
echo -e "│ Libs:      ${YELLOW}$LIBS${RESET}"
echo -e "└──────────────────────────────────────────────┘"
echo -e ""

bun add $LIBS --cwd "$TARGET_PATH"
EXIT_CODE=$?

echo -e ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✔${RESET} ${BOLD}Done${RESET} ${GRAY}(bun add completed successfully)${RESET}"
else
  echo -e "${RED}✖${RESET} ${BOLD}bun add failed${RESET} ${GRAY}(exit code: $EXIT_CODE)${RESET}"
fi

exit $EXIT_CODE