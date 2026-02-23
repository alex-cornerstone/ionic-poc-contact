# Mobile Deployment Guide — POC Contact App

**Stack:** Ionic 8 + Angular 20 + Capacitor 8 (frontend) · ASP.NET Core 10 (API)
**Target:** iOS TestFlight + Android Play Store Internal Track via Codemagic CI/CD
**Platform:** Windows 11 (local machine)

---

## Project State Before Starting

| Item | Status |
|------|--------|
| Native `ios/` folder | Not generated yet |
| Native `android/` folder | Not generated yet |
| App Bundle ID | `io.ionic.starter` — must change |
| API URL in app | Hardcoded to `localhost` — must change |
| `codemagic.yaml` | Not present — must create |
| API hosting | Local only — must deploy |

---

## Phase 1 — Local Prerequisites

Make sure the following are installed on your Windows machine. Xcode and Android Studio are **not** required locally — Codemagic handles native compilation.

```bash
# Verify Node.js (18+ required)
node --version

# Verify npm
npm --version

# Install Ionic CLI globally
npm install -g @ionic/cli

# Install Angular CLI globally
npm install -g @angular/cli

# Verify .NET 10 SDK (for the API)
dotnet --version
```

> **Optional:** Install Android Studio if you want to run and test the Android app locally before pushing to Codemagic.

---

## Phase 2 — Fix Critical Configuration Issues

These must all be resolved before adding native platforms. Do them in the order listed.

---

### Step 1 — Deploy the API

Your ASP.NET Core API currently runs only on `localhost:7213`. A mobile app installed on a real device cannot reach localhost — it needs a publicly accessible HTTPS URL.

**Recommended options for a POC:**

| Platform | Cost | Effort | Notes |
|----------|------|--------|-------|
| Railway.app | Free tier | Low | Connect Git repo, auto-deploys |
| Render.com | Free tier | Low | Connect Git repo, auto-deploys |
| Azure App Service (F1) | Free | Medium | Microsoft ecosystem, familiar |
| Azure Container Apps | Pay-per-use | Medium | Good for containerised APIs |

Once deployed you will have a URL such as `https://poc-contact-api.railway.app`.
**Save this URL — you need it in Step 2.**

---

### Step 2 — Add `apiUrl` to Angular environment files

**`app/src/environments/environment.ts`** (development — still points to localhost):

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7213'
};
```

**`app/src/environments/environment.prod.ts`** (production — replace the placeholder with your deployed URL):

```typescript
export const environment = {
  production: true,
  apiUrl: 'YOUR_DEPLOYED_API_URL'   // e.g. https://poc-contact-api.railway.app
};
```

> During an Angular production build (`ng build --configuration production`), the build toolchain automatically replaces `environment.ts` with `environment.prod.ts`, so the app will use the real API URL in the shipped binary.

---

### Step 3 — Wire components to use `environment.apiUrl`

Replace the two hardcoded `localhost` references in the app.

**`app/src/app/components/contact-message/contact-message.component.ts`:**

```typescript
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
         IonContent, IonItem, IonInput, IonTextarea } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';   // ← add this

@Component({ ... })
export class ContactMessageComponent {
  private readonly apiBaseUrl = environment.apiUrl;   // ← replace hardcoded string
  ...
}
```

**`app/src/app/contacts/contacts.page.ts`:**

```typescript
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';   // ← add this
...

export class ContactsPage implements OnInit {
  private readonly apiBaseUrl = environment.apiUrl;   // ← replace hardcoded string
  ...
}
```

---

### Step 4 — Update `capacitor.config.ts` with your real app identity

The bundle ID you set here becomes permanent once registered with Apple and Google. Choose a reverse-domain string you own.

**`app/capacitor.config.ts`:**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.poccontact',   // ← your real bundle ID
  appName: 'POC Contact',              // ← your app display name
  webDir: 'www'
};

export default config;
```

> **Rule of thumb:** `appId` must be lowercase, no hyphens, no spaces. Match this exactly in App Store Connect and the Google Play Console in the next phases.

---

## Phase 3 — Install Dependencies, Build, and Add Native Platforms

Run all of the following commands from the `app/` directory.

```bash
cd app

# 1. Install Node dependencies
npm install

# 2. Build the Angular app for production (outputs to www/)
npm run build -- --configuration production

# 3. Add iOS and Android native projects (only run once per project)
npx cap add ios
npx cap add android

# 4. Copy the web build into the native projects and update plugins
npx cap sync
```

After `cap add ios` and `cap add android` you will have new `ios/` and `android/` folders inside `/app`.

> **Commit these folders to Git.** Codemagic clones your repository and builds from the native project files — they must be present in the repo.

```bash
git add app/ios app/android
git commit -m "Add Capacitor native platforms (iOS and Android)"
```

---

### What each command does

| Command | What it does |
|---------|--------------|
| `npm run build -- --configuration production` | Compiles Angular + Ionic to static files in `app/www/` |
| `npx cap add ios` | Scaffolds a full Xcode project in `app/ios/` |
| `npx cap add android` | Scaffolds a full Android Gradle project in `app/android/` |
| `npx cap sync` | Copies `www/` into both native projects and installs native plugin code |

> Run `npx cap sync` every time you change Angular code before building natively. In the Codemagic pipeline this is automated.

---

## Phase 4 — Create `codemagic.yaml`

Create this file at the **repository root** (`poc-contact/codemagic.yaml`). It defines two separate workflows — one for iOS and one for Android.

```yaml
workflows:

  # ─── iOS workflow ──────────────────────────────────────────────────────────
  ios-workflow:
    name: iOS TestFlight
    max_build_duration: 60
    instance_type: mac_mini_m2

    environment:
      ios_signing:
        distribution_type: app_store          # Use 'ad_hoc' for direct device installs
        bundle_identifier: com.yourname.poccontact  # Must match capacitor.config.ts
      vars:
        XCODE_PROJECT: "app/ios/App/App.xcodeproj"
        XCODE_SCHEME: "App"
      node: latest

    scripts:
      - name: Install Node dependencies
        script: |
          cd app
          npm ci

      - name: Build Angular app (production)
        script: |
          cd app
          npm run build -- --configuration production

      - name: Capacitor sync
        script: |
          cd app
          npx cap sync ios

      - name: Set iOS build number to Codemagic build number
        script: |
          cd app/ios/App
          agvtool new-version -all $(($(app-store-connect get-latest-testflight-build-number \
            "YOUR_APP_STORE_APP_ID") + 1))

      - name: Build iOS .ipa
        script: |
          xcode-project use-profiles
          cd app/ios/App
          xcodebuild -project App.xcodeproj \
            -scheme App \
            -configuration Release \
            -archivePath $CM_BUILD_DIR/App.xcarchive \
            archive
          xcodebuild -exportArchive \
            -archivePath $CM_BUILD_DIR/App.xcarchive \
            -exportPath $CM_BUILD_DIR/ipa \
            -exportOptionsPlist /Users/builder/export_options.plist

    artifacts:
      - app/ios/App/**/*.ipa
      - /tmp/xcodebuild_logs/*.log

    publishing:
      app_store_connect:
        auth: integration          # Set up App Store Connect API key in Codemagic UI
        submit_to_testflight: true
        beta_groups:
          - "Internal Testers"     # Name of your TestFlight group

  # ─── Android workflow ──────────────────────────────────────────────────────
  android-workflow:
    name: Android Play Store
    max_build_duration: 60
    instance_type: linux_x2

    environment:
      android_signing:
        - my_keystore                          # Name of keystore credential in Codemagic UI
      vars:
        PACKAGE_NAME: "com.yourname.poccontact"  # Must match capacitor.config.ts
      node: latest

    scripts:
      - name: Install Node dependencies
        script: |
          cd app
          npm ci

      - name: Build Angular app (production)
        script: |
          cd app
          npm run build -- --configuration production

      - name: Capacitor sync
        script: |
          cd app
          npx cap sync android

      - name: Set Android version code
        script: |
          cd app/android
          LATEST_BUILD_NUMBER=$(google-play get-latest-build-number \
            --package-name "$PACKAGE_NAME" 2>/dev/null || echo "0")
          cd app/android/app
          sed -i "s/versionCode .*/versionCode $((LATEST_BUILD_NUMBER + 1))/" build.gradle

      - name: Build Android release AAB
        script: |
          cd app/android
          ./gradlew bundleRelease

    artifacts:
      - app/android/app/build/outputs/**/*.aab
      - app/android/app/build/outputs/**/*.apk
      - app/android/app/build/outputs/**/mapping.txt

    publishing:
      google_play:
        credentials: $GCLOUD_SERVICE_ACCOUNT_CREDENTIALS
        track: internal                        # internal → alpha → beta → production
```

> **Note:** Replace `YOUR_APP_STORE_APP_ID` with the 10-digit numeric ID shown in App Store Connect (not the bundle ID string).

---

## Phase 5 — Developer Account Setup

Complete these steps before configuring Codemagic. Codemagic needs the credentials you generate here.

---

### Apple (required for iOS TestFlight)

1. **Apple Developer Program** — $99/year at [developer.apple.com](https://developer.apple.com)

2. **Register your App Identifier**
   - Log into [developer.apple.com/account](https://developer.apple.com/account)
   - Certificates, Identifiers & Profiles → Identifiers → `+`
   - Select "App IDs", type "App"
   - Enter your bundle ID (e.g. `com.yourname.poccontact`)
   - Enable any capabilities you need (Push Notifications, etc.)

3. **Create the app in App Store Connect**
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → `+`
   - Platform: iOS, Name: your app name, Bundle ID: select from the dropdown
   - Note the **Apple ID** (10-digit number shown on the app's page) — used in `codemagic.yaml`

4. **Create an App Store Connect API Key** (recommended — lets Codemagic manage signing automatically)
   - App Store Connect → Users and Access → Integrations → Keys → `+`
   - Role: **App Manager** (or Admin)
   - Download the `.p8` file (you can only download it once)
   - Note the **Key ID** and **Issuer ID**

5. **Upload credentials to Codemagic UI**
   - Codemagic → Teams → your team → Integrations → App Store Connect
   - Upload the `.p8` key file, enter Key ID and Issuer ID
   - Codemagic will then manage certificates and profiles automatically

---

### Google (required for Android Play Store)

1. **Google Play Console** — one-time $25 fee at [play.google.com/console](https://play.google.com/console)

2. **Create your app**
   - Create app → enter app name, select "App", choose "Free" or "Paid"
   - Package name must match your `capacitor.config.ts` `appId`

3. **Create a service account for API access**
   - Play Console → Setup → API access → Link to a Google Cloud project
   - Google Cloud Console → IAM → Service Accounts → Create
   - Grant role: **Service Account User** + **Release Manager** in Play Console
   - Create and download the **JSON key file**

4. **Create your Android signing keystore** (run locally — keep this file safe forever)

   ```bash
   keytool -genkey -v \
     -keystore my-release-key.jks \
     -alias my-key-alias \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   ```

   You will be prompted for a keystore password and key password — save both securely (a password manager is ideal). If you lose the keystore or forget the passwords you cannot update the app on the Play Store.

5. **Upload credentials to Codemagic UI**
   - Codemagic → App Settings → Environment variables → Android code signing
   - Upload the `.jks` file, enter the keystore password, key alias, and key password
   - Name the credential `my_keystore` (must match the name in `codemagic.yaml`)
   - Add the Google Play JSON key as the environment variable `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`

---

## Phase 6 — Connect to Codemagic and Trigger Builds

1. **Push your repository to a Git host**

   ```bash
   # From the repo root (poc-contact/)
   git init                              # if not already a git repo
   git add .
   git commit -m "Initial commit with mobile build config"

   # Push to GitHub, GitLab, or Bitbucket
   git remote add origin https://github.com/yourname/poc-contact.git
   git push -u origin main
   ```

2. **Sign up and connect the repo in Codemagic**
   - Go to [codemagic.io](https://codemagic.io) and sign in with your Git provider
   - Add application → select your repository
   - Codemagic will detect `codemagic.yaml` automatically

3. **Add all credentials in the Codemagic UI** (from Phase 5)
   - App Store Connect API key (for iOS signing and TestFlight upload)
   - Android keystore (for APK/AAB signing)
   - Google Play service account JSON (for Play Store upload)

4. **Trigger a build**
   - In Codemagic → select `ios-workflow` or `android-workflow`
   - Click "Start new build"
   - Monitor logs in real time

5. **iOS: accept the TestFlight build**
   - After a successful iOS build, the `.ipa` is automatically submitted to TestFlight
   - In App Store Connect → TestFlight → your build will appear within minutes
   - Add internal testers by email under the "Internal Testing" group

6. **Android: check the Play Store internal track**
   - After a successful Android build, the `.aab` is uploaded to the internal track
   - In Google Play Console → Testing → Internal testing → your release will be listed
   - Add testers by email or Google Group

---

## Summary Checklist

### Local tasks (complete before pushing)

- [x] `environment.ts` — `apiUrl` added (points to localhost for local dev)
- [x] `environment.prod.ts` — `apiUrl` added (update placeholder with real URL after API deployment)
- [x] `contact-message.component.ts` — uses `environment.apiUrl`
- [x] `contacts.page.ts` — uses `environment.apiUrl`
- [x] `capacitor.config.ts` — `appId` and `appName` updated (replace placeholder values)
- [x] `codemagic.yaml` — created at repo root
- [ ] Deploy API to Railway / Render / Azure → update `environment.prod.ts` with real URL
- [ ] `cd app && npm install`
- [ ] `npm run build -- --configuration production`
- [ ] `npx cap add ios`
- [ ] `npx cap add android`
- [ ] `npx cap sync`
- [ ] Commit `app/ios/` and `app/android/` folders to Git
- [ ] Generate Android keystore with `keytool` and store it safely

### Account setup (before configuring Codemagic)

- [ ] Apple Developer Program enrolled ($99/year)
- [ ] App Identifier registered in Apple developer portal
- [ ] App created in App Store Connect
- [ ] App Store Connect API key (`.p8`) downloaded
- [ ] Google Play Console account created ($25 one-time)
- [ ] Android app created in Play Console
- [ ] Google Play service account JSON downloaded

### Codemagic

- [ ] Repository pushed to GitHub / GitLab / Bitbucket
- [ ] Repository connected in Codemagic UI
- [ ] App Store Connect API key uploaded to Codemagic
- [ ] Android keystore uploaded to Codemagic
- [ ] Google Play service account JSON added as environment variable
- [ ] First iOS build triggered and `.ipa` submitted to TestFlight
- [ ] First Android build triggered and `.aab` uploaded to Play Store internal track

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/capacitor.config.ts` | Bundle ID, app name, web output directory |
| `app/src/environments/environment.ts` | Dev config — API URL for local development |
| `app/src/environments/environment.prod.ts` | Prod config — API URL for Codemagic production builds |
| `app/ios/` | Generated Xcode project — commit to Git |
| `app/android/` | Generated Android Gradle project — commit to Git |
| `codemagic.yaml` | CI/CD pipeline definition for Codemagic |
| `my-release-key.jks` | Android signing keystore — **never commit to Git** |
