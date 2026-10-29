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

Use an account's actual password. The old universal development password is not accepted. Hosted API routes verify signed sessions and current account status; administrative actions require an administrator. Mobile password login also obtains its session from the API. Existing direct mobile Supabase operations continue to depend on the database's RLS policies; deploying the API does not replace or migrate those policies.

## AI project

Create a separate Vercel project rooted in ai-server. The FastAPI configuration uses Python 3.12 and CPU-only PyTorch. The build downloads the existing E5-base-v2 and CLIP ViT-B/32 model files into an ignored model-cache directory so requests do not download weights into temporary storage.

Set AI_SERVICE_KEY to the same private value used by the admin/API project. Set VERCEL_SUPPORT_LARGE_FUNCTIONS=1 for Vercel's Large Functions support and TOKENIZERS_PARALLELISM=false. Model endpoints require the private bearer key. The health endpoint is public. Do not add this key to mobile, a VITE variable or an EXPO_PUBLIC variable.

The AI project uses the account's existing plan limits. Model startup, memory and request duration must be checked on the deployed service before treating it as ready. No paid plan upgrade is part of this setup.

## Mobile builds

Set EXPO_PUBLIC_API_URL to the hosted admin origin followed by /api, and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the configured public Google client ID. These public settings may be supplied through EAS environments. Provider API keys and service-role keys must remain on the server. Rebuild the app to change bundled EXPO_PUBLIC values; an existing installation can also change the server URL in its connection settings.

## Verification

Check /api/health, unauthenticated rejection of protected endpoints, signed-in navigation, report details, saved matching pairs, feedback and notifications. For the AI service verify health plus text/image dimensions and real matching with isolated inputs. Test write operations using isolated records, rather than releasing real user items during deployment checks.
