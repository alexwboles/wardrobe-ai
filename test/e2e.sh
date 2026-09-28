#!/bin/bash
# Wardrobe AI e2e — realistic user flows through the logic layer (node).
set -e
cd "$(dirname "$0")/.."
node test/run-e2e.js
