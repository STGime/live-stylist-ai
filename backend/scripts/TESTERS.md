# Tester / beta-access management

Testers skip the 1-session lifetime trial and get
`TESTER_MONTHLY_SESSION_CAP` (currently **100**) sessions per month. Their
sessions are recorded with `subscription_tier='tester'` in the `sessions`
table, so cost reporting per tier still works.

There are two independent ways to grant tester status. Either is enough —
the backend checks both on every `POST /start-session`.

## 1. Build-time secret (your own dev installs, no per-device admin)

Preview and development builds bundle `EXPO_PUBLIC_TESTER_SECRET` (an
EAS env var scoped to those two environments). At runtime the app sends
the value as the `X-Tester-Secret` HTTP header on every backend request.
If it matches `TESTER_SECRET` on the server (mounted from GCP Secret
Manager: `tester-secret`), the request is granted tester tier.

**Production / App Store / TestFlight builds do NOT include the secret**,
because the EAS env var is scoped away from the `production` environment.

To rotate the secret:

```bash
# 1. Generate a new value
NEW=$(openssl rand -hex 32)

# 2. Add a new version to GCP Secret Manager (Cloud Run picks up :latest
#    on the next revision)
printf '%s' "$NEW" | gcloud secrets versions add tester-secret \
  --project=livestylist-8f221 --data-file=-

# 3. Replace the EAS env var so the next preview build matches
eas env:create --name EXPO_PUBLIC_TESTER_SECRET --value "$NEW" \
  --visibility sensitive --environment preview --environment development \
  --scope project --force --non-interactive

# 4. Force a Cloud Run revision so the new secret is loaded
gcloud run services update livestylist-backend \
  --project=livestylist-8f221 --region=us-central1 --no-traffic
gcloud run services update-traffic livestylist-backend \
  --project=livestylist-8f221 --region=us-central1 --to-latest

# 5. Rebuild + reinstall the preview app
( cd ../../app && eas build --platform ios --profile preview )
```

## 2. Device-ID allowlist (TestFlight betas + anyone on a production build)

For external testers who you don't want to rebuild the app for, add their
device id (visible in their app under Profile → "Device ID — long-press
to copy") to the comma-separated `TESTER_DEVICE_IDS` Cloud Run env var.
Cloud Run hot-swaps env vars in seconds — no rebuild needed.

Use `scripts/tester.sh`:

```bash
# What's on the allowlist now?
./scripts/tester.sh list

# Grant tester access to a new device
./scripts/tester.sh add 6c4b3a26-1b9e-4f8a-9c5e-2e3a1f7d4b8c

# Revoke tester access
./scripts/tester.sh remove 6c4b3a26-1b9e-4f8a-9c5e-2e3a1f7d4b8c
```

The script is a thin wrapper around `gcloud run services update
--update-env-vars`. If `gcloud` isn't handy, you can do the same manually:

```bash
gcloud run services update livestylist-backend \
  --project=livestylist-8f221 --region=us-central1 \
  --update-env-vars=TESTER_DEVICE_IDS=id1,id2,id3
```

### Caveats

- **Reinstalls give a new device id.** The current device id is stored
  in `AsyncStorage` and is wiped on uninstall, so a tester who reinstalls
  will reappear with a fresh UUID and lose tester status until they send
  the new id. (Long-term fix: switch to `identifierForVendor` on iOS,
  which survives reinstall as long as another app from the same vendor
  is installed.)
- **Removing a tester only stops *new* sessions.** An in-flight session
  is unaffected and will run to its 5-min timeout.
- **Cap is per-tier, not per-bypass.** A tester who burns through 100
  sessions in a month hits `monthly_cap` exactly the same as a premium
  user hits theirs at 30. Bump `TESTER_MONTHLY_SESSION_CAP` on Cloud Run
  if 100 isn't enough.
