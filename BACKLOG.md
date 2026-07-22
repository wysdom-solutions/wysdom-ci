# Backlog — issues to file once the repo is live

Deferred work captured during the initial build. File these as GitHub issues after the
`wysdom-solutions/wysdom-ci` repo is created (repo creation is currently on hold).

- **"Codecov light" — own coverage checking.** Not every consumer uses Codecov; some run
  their own coverage checks. Instead of depending on the third-party `codecov/codecov-action`,
  build a lightweight, self-owned coverage gate (parse the coverage summary, enforce a
  threshold, comment/annotate) so the shared test workflow stays free of that dependency.
  Until then, `expo-test.yml` only uploads the coverage report as a build artifact.

- **Expo SDK-version resilience.** The prebuild-based build assumes a generated
  native-project shape (AAB output path, `ios/*.xcworkspace`, the config plugin's
  `build.gradle` patch targets) that can shift across Expo SDK majors. Consumers pin their
  own Expo/Node/Java, but the workflow's assumptions aren't version-guarded. Consider:
  asserting the expected prebuild outputs exist (fail with a clear message if the shape
  changed), and/or documenting a supported Expo SDK range. Optionally a Node-version matrix
  in `expo-test.yml` for consumers that must support several.

- **Replace external action dependencies with our own CLI steps.** Progressively retire the
  kept third-party actions (`apple-actions/import-codesign-certs`,
  `apple-actions/upload-testflight-build`, `maxim-lobanov/setup-xcode`,
  `gradle/actions/setup-gradle`, `ruby/setup-ruby`) in favor of self-owned CLI logic
  (`security`, `xcrun altool`, `xcode-select`, manual Gradle cache, direct fastlane install)
  where the tradeoff is worth it. Reduces the supply-chain surface of this shared chokepoint.
  Do it per-action, each validated on a real run. Until then, all are SHA-pinned.

- **Store release notes ("What's new" / "What to Test") on the deploy workflows.** The
  release build currently ships store binaries with **no** release notes: Play `supply`
  runs with `--skip_upload_changelogs`, and the TestFlight upload sets no "What to Test"
  text. Fine while both targets are internal-only (no review, tiny tester circle), but the
  moment a consumer promotes to a user-facing track (closed/open beta or production) the
  notes matter. When we build it: source the text from **one** place (git tag annotation or
  a `CHANGELOG.md`) and fan it out to all three consumers — Play (`metadata/android/<lang>/
  changelogs/<versionCode>.txt`, dropping `--skip_upload_changelogs`), TestFlight (a
  fastlane `pilot` / ASC API step — the current upload action can't set test notes), and the
  GitHub Release body. First surfaced cutting `hench-goblin` v0.2.1 (`#150` store
  auto-deploy). Until then, store builds carry no changelog and the GitHub Release uses
  auto-generated notes.

- **Migrate hench-goblin and fuzz-noise CI to this shared tooling.** Replace their standalone
  workflows with thin callers of `expo-test.yml` / `expo-android-release.yml` /
  `expo-ios-release.yml`; re-set each repo's Android secrets to the canonical names
  (`ANDROID_KEYSTORE_*`, `ANDROID_KEY_*`, `ANDROID_PLAY_SERVICE_ACCOUNT_JSON`); for fuzz-noise,
  add the net-new iOS caller once its signing secrets exist. Prove identical signed artifacts on
  a throwaway tag before switching callers to `@v1`. fuzz-noise pilots first (hench-goblin is the
  reference, so mostly a secret-name no-op). This is where the two live-run watchouts — the iOS
  export `method` value and cross-repo `./` action resolution — actually get exercised.
