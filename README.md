# Lost & Found capstone

The applications and services are in separate folders:

| Folder | Purpose |
| --- | --- |
| `web/` | React and Vite admin dashboard |
| `mobile/` | Expo and React Native mobile application |
| `server/` | Express API shared by the apps |
| `ai-server/` | Python service for image and text matching |
| `docs/` | Project diagrams and documentation |

`supabase-schema.sql` contains the shared database schema. Each JavaScript app or service has its own `package.json` and lockfile; run its commands from that folder.

## Web admin dashboard

```powershell
cd web
npm install
npm run dev
```

The dashboard runs on port 5173 and proxies `/api` requests to the Express server on port 3001. Run `npm run build` in `web/` to make a production build.

## Mobile application

```powershell
cd mobile
npm install
npm start
```

Use `npm run android` for an Android development build. The app can detect the API URL from Expo during development; a server URL can also be set in the app's settings when running on a device.

## API server

```powershell
cd server
npm install
npm run dev
```

The API reads its environment variables from `server/.env` and listens on port 3001 by default. Keep credentials in that ignored file.

For handover evidence, apply `server/add-handover-photo.sql` after `server/add-recovery-feedback.sql` and `server/cancel-potential-match.sql`, before deploying the updated API. New releases require a photo and recorded ownership questions and answers; older claim records remain viewable without these newer fields. Photos are resized in the browser. The API saves the photo, `knowledge_answers`, and separate notes in the protected `item_recoveries` record, in the same transaction as both item statuses and the claim log. Legacy Q&A remains in the original notes.

Before deploying found item reminders, apply [the reminder migration](supabase/migrations/20261109125338_found_item_reminders.sql) to the Supabase database after `server/secure-data-access.sql`. The migration registers the `found-item-turnover-reminders` Supabase Cron job. In **Settings → Found item reminders**, choose 8 or 24 hours or enter a custom delay, edit and preview the message, then enable reminders and save. Pending reports that already meet the delay become eligible at the next run. In **Found items**, use **Confirm OSDS receipt** after accepting the item to activate the report and end its reminder eligibility.

Apply [the cancellation attribution migration](supabase/migrations/20261109131320_report_cancellation_actor.sql) before restarting or deploying the API with cancellation attribution. It links older cancellations to matching activity records where the actor can be identified.

## AI service

```powershell
cd ai-server
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The Express API calls this service on port 8000 by default for matching features.

## Hosting

The root Vercel project builds the web admin and serves its Express API. The Python models deploy as a separate AI project. See [deployment setup](docs/deployment.md) for environment variables, mobile configuration and verification. Keep all real .env files and deployment credentials out of Git.

### Hosted services

- Admin: https://lost-found-admin-eta.vercel.app
- API health: https://lost-found-admin-eta.vercel.app/api/health
- AI service: https://lost-found-ai-sable.vercel.app/health (inference requires the private server key)

Mobile preview and production profiles use the hosted API. Production builds ignore old saved development addresses. See [Android release notes](mobile/RELEASE.md) for standalone installation and updates. Push tested web/API fixes to `main` for the connected Vercel production workflow described in [deployment setup](docs/deployment.md).
