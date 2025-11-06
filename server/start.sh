#!/bin/bash
# Server startup script with environment variables

# Load environment variables from .env file
set -a
source .env 2>/dev/null || echo "Warning: .env file not found"
set +a

# Ensure DEMO_MODE is set for development
export DEMO_MODE=true
export NODE_ENV=development

echo "Starting server with:"
echo "  PORT=${PORT:-8787}"
echo "  DEMO_MODE=$DEMO_MODE"
echo "  JWT_SECRET=${JWT_SECRET:0:10}..."

# Start the server
node server/index.js
