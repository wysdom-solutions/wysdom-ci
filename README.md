# wysdom-ci

**Shared, reusable GitHub Actions CI for Wysdom Solutions' Expo React Native apps.**

One canonical home for the test / build / release pipelines, called by each product repo
instead of every repo maintaining its own near-identical YAML. Fix a build step here once;
every consumer picks it up on its next version bump. See [DESIGN.md](DESIGN.md) for the full
rationale and the design decisions behind it.

- **Status:** 🟢 Workflows + composite authored and statically validated. Repo creation, the
  `@v1` cut, and live (real-secret) validation are pending. Deferred work is tracked in
  [BACKLOG.md](BACKLOG.md).
- **Scope:** Expo RN apps only (test + Android AAB + iOS TestFlight). Non-Expo pipelines are a
  separate future family.

## What's here

| Workflow / action | Purpose |
|---|---|
| `.github/workflows/expo-test.yml` | type-check + lint + format + coverage, with a **changed-files gate** so docs-only PRs still report a green required check |
| `.github/workflows/expo-android-release.yml` | prebuild → signed AAB (upload key) → Gradle cache → optional Play internal upload → draft release |
| `.github/workflows/expo-ios-release.yml` | prebuild → archive → TestFlight → draft release |
| `.github/actions/resolve-expo-version` | composite: resolve + validate the version from `app.json` (tag ↔ `app.json` guard, injection-safe) |

## Callers

Test on every PR + push:

```yaml
# product-repo/.github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    uses: wysdom-solutions/wysdom-ci/.github/workflows/expo-test.yml@v1
    secrets: inherit
```

Release on a `v*` tag:

```yaml
# product-repo/.github/workflows/release.yml
on:
  workflow_dispatch:
    inputs: { versionName: { required: false, default: '' } }
  push:
    tags: ['v[0-9]*']
jobs:
  android:
    uses: wysdom-solutions/wysdom-ci/.github/workflows/expo-android-release.yml@v1
    with: { app-slug: my-app, package-name: com.wysdomsolutions.myapp }
    secrets: inherit
  ios:
    uses: wysdom-solutions/wysdom-ci/.github/workflows/expo-ios-release.yml@v1
    with: { app-slug: my-app, bundle-id: com.wysdomsolutions.myapp }
    secrets: inherit
```

## Inputs (summary)

- **expo-test:** `working-directory` (`src`), `node-version` (`20.x`), `run-lint` (`true`),
  `run-format-check` (`true`).
- **android:** `app-slug` (required), `working-directory`, `node-version`, `java-version` (`17`),
  `package-name`, `publish-to-play` (`false`), `play-track` (`internal`), `version-name`.
- **ios:** `app-slug` (required), `bundle-id` (required), `working-directory`, `node-version`,
  `xcode-version` (`latest-stable`), `version-name`.

## Secrets

No secrets are stored in this repo — they resolve in the caller's context via `secrets: inherit`.

- **Android:** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD` · (optional Play upload) `ANDROID_PLAY_SERVICE_ACCOUNT_JSON`
- **iOS:** `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_KEYCHAIN_PASSWORD`,
  `IOS_PROVISIONING_PROFILE_BASE64`, `APPLE_TEAM_ID`, `APP_STORE_CONNECT_ISSUER_ID`,
  `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8`

Android release signing itself is applied by the **consumer app's** Expo release-signing config
plugin during `expo prebuild`; this repo supplies only the upload-key credentials (as Gradle
project properties).

## Consumers (target state)

| App | Test | Android | iOS |
|---|---|---|---|
| hench-goblin | ✅ | ✅ | ✅ |
| fuzz-noise | ✅ | ✅ | ➕ new |
| glass-buddy | ✅ | ➕ new | ➕ new |

Migration is one repo at a time; adopting a caller touches nothing until that repo opts in.

## Security posture

This repo is a **chokepoint** — its reusable workflows run in each consumer's context with that
consumer's signing secrets. Accordingly: non-`actions/*` third-party actions are **SHA-pinned**,
every workflow declares least-privilege `permissions:`, trivial logic is inlined rather than
pulled from an action, and no secrets live here.
