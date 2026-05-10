#!/usr/bin/env bash
# Deploys the LiveStylist backend to Cloud Run via cloudbuild.yaml.
#
# Prereqs:
#   - gcloud CLI authenticated
#   - Project livestylist-8f221 has secrets:
#       gemini-api-key, revenuecat-api-key, eurobase-secret-key
#   - Cloud Build service account has roles/run.admin + roles/iam.serviceAccountUser
set -euo pipefail

PROJECT_ID="livestylist-8f221"
REGION="us-central1"

cd "$(dirname "$0")"

echo "Submitting build to Cloud Build (project=$PROJECT_ID)..."
gcloud builds submit \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --config cloudbuild.yaml \
  .

URL=$(gcloud run services describe livestylist-backend \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)')

echo
echo "Deployed: $URL"
echo "Smoke check:"
curl -sS "$URL/ready" && echo
