#!/bin/bash
# Starts the Freetip OBS clip helper. Double-click this file.
cd "$(dirname "$0")" || exit 1
if [ ! -f config.json ]; then
  echo "config.json is missing. Copy config.example.json to config.json and fill it in."
  read -r -p "Press Enter to close."
  exit 1
fi
[ -d node_modules ] || { echo "Installing, one moment..."; npm install; }
node src/main.mjs
read -r -p "Press Enter to close."
