#!/bin/bash
if [ "$VITE_MODE" = "staging" ]; then
  npm run build:staging
else
  npm run build
fi
