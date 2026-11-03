# Hosted deployment

The repository includes the web admin, Expo mobile app, Express API and Python AI service.

## Admin and API project

Deploy the repository root using the root vercel.json. It builds web/dist and serves the Express app through api/index.mjs. React routes fall back to index.html, while /api requests go to Express. Local development still uses server/index.js and its embedding poller.

Configure these values in the Vercel project environment, never in Git:

- SUPABASE_URL and SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY for verified recoveries and feedback
- JWT_SECRET, a long random signing secret
- GOOGLE_WEB_CLIENT_ID and SCHOOL_EMAIL_DOMAINS
- DEEPGRAM_API_KEY for speech transcription
- AI_SERVER_URL and AI_SERVICE_KEY for the separate model service

Use an account's actual password. The old universal development password is not accepted. Hosted API routes verify signed sessions and current account status; administrative actions require an administrator. Mobile password login also obtains its session from the API. Mobile record operations use authenticated API routes with server-side ownership checks. Private database tables also have restricted RLS policies; deploying code does not apply database migrations. See `docs/secure-data-rollout.md` for the separate database rollout.

## GitHub updates

The release branch is `main` in `Wardjay45/Lost-and-found-system`. Connect that repository to the existing `lost-found-admin` Vercel project and select `main` as its production branch. Keep the project root at the repository root so the checked-in `vercel.json` builds both the admin and API.

For future releases, run the relevant tests and the web build, commit the fixes, and push or merge into `main`. With the Git connection enabled, Vercel creates a production deployment automatically. Wait for Ready and verify the deployed commit before treating the update as live. Other branches normally create previews. Database migrations and the separate AI service deployment remain separate operations.

The production URL stays https://lost-found-admin-eta.vercel.app. Compatible web/API updates at that address do not require reinstalling the mobile APK. Changes to bundled mobile code or its public API address require a new mobile build.

## AI project

Create a separate Vercel project rooted in ai-server. The FastAPI configuration uses Python 3.12 and CPU-only PyTorch. The build downloads the existing E5-base-v2 and CLIP ViT-B/32 model files into an ignored model-cache directory so requests do not download weights into temporary storage.

Set AI_SERVICE_KEY to the same private value used by the admin/API project. Set VERCEL_SUPPORT_LARGE_FUNCTIONS=1 for Vercel's Large Functions support and TOKENIZERS_PARALLELISM=false. Model endpoints require the private bearer key. The health endpoint is public. Do not add this key to mobile, a VITE variable or an EXPO_PUBLIC variable.

The AI project uses the account's existing plan limits. Model startup, memory and request duration must be checked on the deployed service before treating it as ready. No paid plan upgrade is part of this setup.

## Mobile builds

Set EXPO_PUBLIC_API_URL to the hosted admin origin followed by /api, and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the configured public Google client ID. These public settings may be supplied through EAS environments. Provider API keys and service-role keys must remain on the server. Rebuild the app to change bundled EXPO_PUBLIC values; development builds can change the server URL in connection settings. Production builds use the bundled HTTPS address and ignore a previously saved development server address.

## Verification

Check /api/health, unauthenticated rejection of protected endpoints, signed-in navigation, report details, saved matching pairs, feedback and notifications. For the AI service verify health plus text/image dimensions and real matching with isolated inputs. Test write operations using isolated records, rather than releasing real user items during deployment checks.
