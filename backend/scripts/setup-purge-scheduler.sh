#!/usr/bin/env bash
# Provision /internal/purge-images end-to-end: secret in Secret Manager,
# Cloud Run runtime SA accessor role, and a daily Cloud Scheduler job that
# hits the endpoint with the required `X-Internal-Secret` header.
#
# Idempotent — safe to re-run. Existing secret / IAM binding / scheduler
# job are reused, not duplicated.
#
# Prereqs:
#   - gcloud authenticated
#   - cloudbuild.yaml already mounts PURGE_SECRET (do this once, then deploy)
#   - /internal/purge-images endpoint deployed to Cloud Run (PR #1 follow feature)
set -euo pipefail

PROJECT_ID="livestylist-8f221"
REGION="us-central1"
SCHEDULER_REGION="us-central1"
SERVICE="livestylist-backend"
SECRET_NAME="purge-secret"
JOB_NAME="purge-expired-images"
# Daily at 04:00 UTC — quiet hour for US/EU users.
SCHEDULE="0 4 * * *"

echo "▶ Project:         $PROJECT_ID"
echo "▶ Region:          $REGION"
echo "▶ Service:         $SERVICE"
echo "▶ Secret:          $SECRET_NAME"
echo "▶ Scheduler job:   $JOB_NAME ($SCHEDULE UTC)"
echo

# 1. Secret in Secret Manager — generate one if it doesn't exist yet.
if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "✓ Secret '$SECRET_NAME' already exists; reusing."
else
  echo "→ Creating secret '$SECRET_NAME' with a fresh random value..."
  printf '%s' "$(openssl rand -hex 32)" \
    | gcloud secrets create "$SECRET_NAME" --project="$PROJECT_ID" --data-file=-
fi

# 2. Grant Cloud Run runtime SA the accessor role (idempotent).
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "→ Granting $RUNTIME_SA accessor role on $SECRET_NAME..."
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

# 3. Verify cloudbuild.yaml references the secret. We can't safely auto-edit
#    YAML from a shell script; warn loudly if missing.
CB_YAML="$(dirname "$0")/../cloudbuild.yaml"
if grep -q "PURGE_SECRET=${SECRET_NAME}:latest" "$CB_YAML"; then
  echo "✓ cloudbuild.yaml already mounts $SECRET_NAME"
else
  echo "✗ cloudbuild.yaml is missing the PURGE_SECRET mount. Add this to --set-secrets:" >&2
  echo "    PURGE_SECRET=${SECRET_NAME}:latest" >&2
  exit 1
fi

# 4. Verify the running service has the env var. If not, the user has not
#    deployed since the cloudbuild.yaml change — bail with a clear message.
if gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
      --format="value(spec.template.spec.containers[0].env)" 2>/dev/null \
   | grep -q "PURGE_SECRET"; then
  echo "✓ Cloud Run revision already exposes PURGE_SECRET"
else
  echo "✗ The deployed Cloud Run revision does not have PURGE_SECRET yet." >&2
  echo "  Run ./deploy.sh first to roll out the updated cloudbuild.yaml, then re-run this script." >&2
  exit 1
fi

# 5. Enable Cloud Scheduler API if needed.
if ! gcloud services list --project="$PROJECT_ID" --enabled \
      --filter="config.name:cloudscheduler.googleapis.com" \
      --format="value(config.name)" | grep -q cloudscheduler; then
  echo "→ Enabling Cloud Scheduler API..."
  gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT_ID"
fi

# 6. Resolve the service URL.
SERVICE_URL=$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')
PURGE_URL="${SERVICE_URL}/internal/purge-images"
echo "▶ Endpoint:        $PURGE_URL"

# 7. Read the secret value so we can inject it as a header on the scheduler job.
SECRET_VALUE=$(gcloud secrets versions access latest \
  --project="$PROJECT_ID" --secret="$SECRET_NAME")

# 8. Create or update the scheduler job.
if gcloud scheduler jobs describe "$JOB_NAME" \
     --project="$PROJECT_ID" --location="$SCHEDULER_REGION" >/dev/null 2>&1; then
  echo "→ Updating existing scheduler job $JOB_NAME..."
  gcloud scheduler jobs update http "$JOB_NAME" \
    --project="$PROJECT_ID" --location="$SCHEDULER_REGION" \
    --uri="$PURGE_URL" \
    --schedule="$SCHEDULE" \
    --time-zone="UTC" \
    --http-method=POST \
    --update-headers="X-Internal-Secret=${SECRET_VALUE}" \
    --quiet
else
  echo "→ Creating scheduler job $JOB_NAME..."
  gcloud scheduler jobs create http "$JOB_NAME" \
    --project="$PROJECT_ID" --location="$SCHEDULER_REGION" \
    --uri="$PURGE_URL" \
    --schedule="$SCHEDULE" \
    --time-zone="UTC" \
    --http-method=POST \
    --headers="X-Internal-Secret=${SECRET_VALUE}" \
    --description="Daily purge of expired session_images rows (24h TTL)." \
    --quiet
fi

echo
echo "✓ Setup complete."
echo
echo "Smoke-test (runs the job once, returns immediately):"
echo "  gcloud scheduler jobs run $JOB_NAME --project=$PROJECT_ID --location=$SCHEDULER_REGION"
echo
echo "Tail the backend logs to confirm '{purged: N} Expired session images purged':"
echo "  gcloud logging tail \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE\" \\"
echo "    --project=$PROJECT_ID --format='value(textPayload)' | grep -i purge"
