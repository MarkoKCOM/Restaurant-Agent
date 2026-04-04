#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source .env

SCOPE="markokcoms-projects"

echo "Building all packages..."
pnpm build

echo "Deploying dashboard..."
cd apps/dashboard
vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE" 2>&1 | tail -3
cd ../..

echo "Deploying marketing site..."
cd apps/marketing-site
vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE" 2>&1 | tail -3
cd ../..

echo "Deploying widget..."
cd apps/booking-widget
vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE" 2>&1 | tail -3
cd ../..

echo "Restarting API..."
sudo systemctl restart sable-api

echo "All deployed!"
