#!/bin/bash
echo "== MainProject Doctor =="

# Check Node version
echo -n "Node version: "
node -v

# Check npm version
echo -n "npm version: "
npm -v

# Check .env file
if [ ! -f .env ]; then
  echo "❌ .env file missing"
else
  echo "✅ .env file present"
fi

# Check required env vars
REQUIRED_VARS=(NODE_ENV SUPABASE_URL SUPABASE_KEY)
for VAR in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^$VAR=" .env; then
    echo "❌ Missing $VAR in .env"
  else
    echo "✅ $VAR set"
  fi
done

# Check for lint errors
npm run lint

# Check for build errors
npm run build

echo "== Doctor checks complete =="
