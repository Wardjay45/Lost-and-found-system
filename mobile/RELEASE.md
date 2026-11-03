# Android release handoff

The standalone Android app uses the same campus API and database as the web administrator dashboard.

- App: `com.university.lostandfound`, version `1.0.0`, release version code `5`.
- App icon and splash source: `mobile/assets/logo.png`.
- Hosted web: https://lost-found-admin-eta.vercel.app
- Mobile API: https://lost-found-admin-eta.vercel.app/api
- Build: https://expo.dev/accounts/ward45/projects/lost-and-found-mobile/builds/e4072466-b55f-4d4e-be2b-fe25bdb1a2e8

The production profile creates a signed APK with its JavaScript included. Expo Go, Metro, and a locally running Express server are not required. Internet access and the hosted API, database, and AI service are required. Release builds ignore previously saved development server addresses.

## Install and update

Download the APK from the build page after its status becomes Finished, transfer it to the Android phone, and open it to install. Android may request permission to install from the browser or file manager. Keep the existing app installed when updating so its local preferences are retained. Future releases must use the existing signing credentials and a higher version code.

The release APK installs as Lost & Found and uses the campus logo. Expo Go has its own launcher icon and is not the release app.

## Verification completed on 4 November 2026 (Asia/Singapore)

Hosted password login, private account data, reports and matches queries, campus locations, categories, conversations, synchronization, speech transcription, and AI matching passed against the production API. An isolated temporary account was removed after the checks. No test report or message was submitted.

Mobile, backend, and web automated checks passed. The web production build passed. A Vercel routing issue that rejected valid mobile record queries was fixed and verified against the live deployment. The web login no longer contains prefilled account credentials.

The APK build and installed-app checks remain pending until Expo finishes the queued build. Google account sign-in, phone microphone/camera permissions, and keyboard visibility should also be confirmed on the target physical phone before distributing the app broadly.

## Release maintenance

Run `eas build --platform android --profile production` from `mobile/` using the existing Expo project and remote signing credentials. The production API address is set in `mobile/eas.json`; changing it requires a new APK. Keep server-only credentials out of mobile configuration. Keep the Google Android OAuth certificate fingerprint registered for the release signing key.

If hosting changes, retain a stable public HTTPS API address and deploy the backend routes with the web. Deploying only the web files does not provide mobile authentication, data, transcription, or matching endpoints. The AI service remains a separate hosted dependency.
