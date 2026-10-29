# School Google registration

New mobile accounts start with **Continue with Google**. The server verifies Google's signed ID token, its audience and expiry, email verification, and the Google Workspace domain. The default allowed domain is `dnsc.edu.ph`; configure exact allowed domains with `SCHOOL_EMAIL_DOMAINS` on the server. A `.edu` substring or a client-provided email is never sufficient.

Verification alone creates no database record. New students must complete full name, student ID, department, gender, password, and the existing optional 11-digit phone number field before an account is saved. Gender choices are Female, Male, Non-binary, and Prefer not to say. The school email is read-only. Passwords remain available for password sign-in and are stored as bcrypt hashes.

## Required setup

1. In Google Cloud, configure the OAuth consent screen and create a **Web application** OAuth client. Set its client ID as `GOOGLE_WEB_CLIENT_ID` in `server/.env` and the same value as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `mobile/.env`. No client secret belongs in the mobile app.
2. Create an **Android** OAuth client for package `com.university.lostandfound` with the SHA-1 certificate fingerprint of each signing key used for your development and release builds. If publishing through Play App Signing, register that signing certificate too. Request only the standard email and profile scopes.
3. For iOS, create an iOS OAuth client for `com.university.lostandfound` and set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `mobile/app.config.js` adds its reversed-client-ID URL scheme. Android uses native autolinking and does not require Firebase configuration files.
4. Configure `SUPABASE_SERVICE_ROLE_KEY` and a strong `JWT_SECRET` in the server environment. Keep the service-role key server-only. Existing server routes still need `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Review and run `server/add-school-google-registration.sql` in the intended Supabase project's SQL editor. It adds nullable profile fields for existing accounts, enforces unique Google subjects, prevents direct anonymous account inserts, and protects verified Google identity from anonymous updates. This script is transactional and safe to rerun. Existing RLS policies remain in place; if RLS was previously disabled, the script preserves legacy profile reads and updates when enabling it. It does not alter existing passwords or link existing accounts automatically. The restrictive insertion policy is required to close the old direct-mobile-registration path.
6. Serve Express over HTTPS and set `EXPO_PUBLIC_API_URL` to its `/api` base URL. The app's existing saved server-address setting remains supported. Google registration now needs this server, because it performs the trusted token verification.
7. Rebuild and install the native app (`npm run android` for a local Android development build, or use the existing EAS build profiles). Updating JavaScript alone cannot add the Google native module. Expo Go cannot run native Google sign-in. Before the Google client ID or new build is configured, the button reports the missing setup instead of creating an account.

## Existing accounts

Existing email/password sign-in remains available. New Google-registered students may also sign in with Google after completing their profile. Suspended, archived, and non-student accounts are rejected by the Google path. A pre-existing profile without a matching verified Google subject must use its existing password; automatic linking is intentionally disabled. An administrator can plan an authenticated account-linking flow separately.

The existing legacy password-login implementation, including its seeded-password bypass, is not a production authentication migration. It needs a separate coordinated migration of existing mobile and admin sessions before a production launch. These changes only introduce verified Google registration and do not activate Supabase Auth or modify `auth.users`.

## Verification

Run `npm test` in `mobile/`. Google registration tests exercise the real account service with isolated database data and replace only the external Google verifier. They cover personal and other-school accounts, invalid verification, missing profile details, password hashing, duplicate accounts, safe response fields, and existing-account restrictions.

The SQL script was also exercised in a disposable local Postgres runtime with both previously disabled RLS and existing restrictive read/update policies. Checks covered rerunning the script, trusted-server registration, denied anonymous inserts, denied identity tampering, duplicate Google subjects, and preserved profile access.

On October 17, 2026, the `add_google_registration_profile_fields` migration was applied to **Lost and found DB**, adding `gender`, `google_subject`, and the unique Google-subject index. After configuring the server's Google client ID and database key, the `enforce_school_google_registration` migration activated the restrictive registration policy and identity-protection trigger. The local backend was restarted and its Google endpoint verified to reject missing Google proof with HTTP 401.

## Local Android OAuth values

For builds signed with the existing `mobile/android/app/debug.keystore`:

- Package: `com.university.lostandfound`
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

The current local Gradle configuration signs both debug and release builds with this development keystore. EAS or Play Store builds can use different certificates; register their actual fingerprints before testing those builds. Do not replace a signing key merely to configure Google sign-in.

Local native builds require a Java 17 JDK and the Android SDK. Set `JAVA_HOME` to Java 17 and `ANDROID_HOME` to the SDK, then run `gradlew.bat assembleDebug` from `mobile/android/`. A verified Temurin Java 17 distribution has been placed in the ignored `mobile/.expo/java17/` cache on this workstation. The development build uses Metro; restart Metro after changing `EXPO_PUBLIC_` environment variables.

The preferred workflow for this project is an Expo EAS development APK: run `eas build --platform android --profile development` from `mobile/` and install from the resulting Expo download page or QR code. The development profile in `eas.json` supplies the public Google client ID and the local development API URL; keep the Supabase server key exclusively in `server/.env`. Update the development API address when the computer's Wi-Fi address changes. Register the actual EAS APK signing fingerprint in Google Cloud if it differs from the local certificate above. The repository's `.easignore` excludes generated Android caches and environment files so the Linux cloud build regenerates native autolinking paths instead of reusing Windows paths.

Run `npx expo config --type public` and an Android bundle export in `mobile/`. On a rebuilt device, check cancellation, no Play services, non-school accounts, valid DNSC onboarding, gender selection, duplicate taps, reauthentication after an expired Google token, large text, and high contrast. A Google Cloud OAuth client, the SQL setup, and a reachable configured server are required for a real account test.

References: [Google server token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [native Google sign-in Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo).
