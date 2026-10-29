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

## AI service

```powershell
cd ai-server
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The Express API calls this service on port 8000 by default for matching features.

## Hosting

The root Vercel project builds the web admin and serves its Express API. The Python models deploy as a separate AI project. See [deployment setup](docs/deployment.md) for environment variables, mobile configuration and verification. Keep all real .env files and deployment credentials out of Git.
