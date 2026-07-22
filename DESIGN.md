# wysdom-ci — design

> Design doc / pull-cord seed for consolidating Wysdom Solutions' Expo RN CI.
> Written 2026-07-08. Resolves `gjwysor/hench-goblin#89`.
> **Settled 2026-07-10:** name = `wysdom-ci` (name-storm); home = **public in the org** (per strategy.md repo doctrine); general shared-CI home (YAML workflows + composite actions now, TS actions optional later).

## 1. Problem

Each Expo RN product repo maintains its own copy of near-identical CI YAML. The
copies have **drifted**, and drift is the whole cost: a fix in one repo doesn't
propagate, and the same work gets checked differently repo-to-repo.

Observed drift (2026-07-08 survey of the three Expo repos; crate-source-go is Godot, excluded):

**Test workflow**

| | hench-goblin | fuzz-noise | glass-buddy |
|---|---|---|---|
| Checks | type-check + lint + **format:check** + coverage | type-check + lint + coverage | type-check + coverage (**no lint/format**) |
| `src` idiom | `defaults.working-directory: src` | `defaults.working-directory: src` | `cd src` in every step |
| Coverage | artifact | artifact | artifact + **Codecov** |
| Workflow name | "CI" | "Test Suite" | "Test Suite" |
| Path filter | `.github/workflows/**` | `.github/workflows/test.yml` | `.github/workflows/test.yml` |

**Android release** — logic is ~95% identical between hench-goblin & fuzz-noise, differing only in:
- **Secret names** — `ANDROID_KEYSTORE_BASE64` (hench) vs `ANDROID_UPLOAD_KEYSTORE_B64` (fuzz), and the whole `*_KEYSTORE_*` vs `*_UPLOAD_*` set.
- **Version-passing idiom** — `$GITHUB_ENV` (hench) vs `$GITHUB_OUTPUT`/`steps.vers.outputs` (fuzz).
- **`--clean`** on `expo prebuild` (hench has it, fuzz doesn't).
- App slug in the artifact filename.

**iOS release** — exists **only in hench-goblin**. fuzz-noise and glass-buddy have no iOS pipeline. A shared workflow makes iOS TestFlight delivery net-new capability for every other app.

## 2. Goal

One shared repo of **reusable workflows** (`workflow_call`) + a **composite action**
for the shared version-resolution logic. Each product repo shrinks to a ~10-line
caller. Changing a build step in one place updates every consumer after a version bump.

Acceptance (from #89): both repos produce identical signed artifacts via the shared
workflow; a build-step change in one place propagates to all consumers.

## 3. Home — decision

**Settled: public `wysdom-solutions/wysdom-ci`, hardened** (issues/wiki/projects off, ruleset on `main`, fork-PR approval, no-secrets discipline). Decided 2026-07-10 via the [strategy.md](../wysdom-solutions/strategy.md) repo doctrine (default private; public-from-inception for harmless/OSS infra) — this repo is pure build recipes (no secrets, no product source), the textbook "harmlessly public from inception" case, and a low-stakes public portfolio rep. Public also *unlocks* free branch protection + rulesets (private repos on Free get neither).

Reasoning:
- **Correct tier.** LLC-owned shared infra spanning products (the "death test" → studio tier). The other shared-infra repos — `wysdom-hub`, `wysdom-site` — are already public in the org. Consistent.
- **Works today *and* future-proofs.** A **public** reusable-workflow repo is callable by *any* repo, including the product repos while they still live under personal `gjwysor`. A **private** repo can only be called by repos under the *same* owner — so a private `gjwysor/wysdom-ci` works today but becomes an orphan the moment product repos migrate into the org (their eventual correct home as LLC products). Public-org has no such cliff.
- **Public leaks nothing.** Reusable-workflow YAML holds build *recipes*, not secrets — secrets resolve in the **caller's** context via `secrets: inherit`. Publishing recipes is industry-normal and on-brand with the Owl Hours build-in-public thread.

Private `gjwysor/wysdom-ci` only wins if committed to *never* moving product repos to the org, and it couples LLC infra to a personal account.

**Naming:** `wysdom-ci` honors the name already used in #89 and fits a repo housing both reusable workflows *and* composite actions.

## 4. Architecture

```
wysdom-solutions/wysdom-ci/
├─ .github/workflows/
│  ├─ expo-test.yml            # reusable: type-check + lint + format + coverage
│  ├─ expo-android-release.yml # reusable: build + sign AAB, optional Play upload
│  └─ expo-ios-release.yml     # reusable: prebuild + archive + TestFlight upload
├─ .github/actions/
│  └─ resolve-version/         # composite: semver-guarded version resolution from app.json
├─ README.md
└─ DESIGN.md
```

Each product repo keeps thin callers under its own `.github/workflows/`:

```yaml
# ci.yml (test on every PR + push)
jobs:
  test:
    uses: wysdom-solutions/wysdom-ci/.github/workflows/expo-test.yml@v1
    secrets: inherit

# release.yml (build on v* tag / manual dispatch)
on:
  workflow_dispatch: { inputs: { versionName: { required: false, default: '' } } }
  push: { tags: ['v[0-9]*'] }
jobs:
  android:
    uses: wysdom-solutions/wysdom-ci/.github/workflows/expo-android-release.yml@v1
    with: { app-slug: fuzz-noise, package-name: com.wysdomsolutions.fuzznoise }
    secrets: inherit
  ios:
    uses: wysdom-solutions/wysdom-ci/.github/workflows/expo-ios-release.yml@v1
    with: { app-slug: fuzz-noise, bundle-id: com.wysdomsolutions.fuzznoise }
    secrets: inherit
```

### 4.1 Inputs contract

**expo-test.yml**
| Input | Default | Purpose |
|---|---|---|
| `working-directory` | `src` | Monorepo app dir |
| `node-version` | `20.x` | |
| `run-lint` | `true` | Toggle so glass-buddy can adopt before adding a lint script |
| `run-format-check` | `true` | Toggle for `format:check` |
| `upload-codecov` | `false` | glass-buddy opts in; others artifact-only |

**expo-android-release.yml**
| Input | Default | Purpose |
|---|---|---|
| `app-slug` | — (req) | AAB filename prefix, e.g. `fuzz-noise` |
| `working-directory` | `src` | |
| `package-name` | `''` | Android applicationId — needed for Play upload |
| `publish-to-play` | `false` | Gate the future Play-upload step (#74/#150) |
| `play-track` | `internal` | Never auto-promote past internal |

**expo-ios-release.yml**
| Input | Default | Purpose |
|---|---|---|
| `app-slug` | — (req) | IPA filename prefix |
| `bundle-id` | — (req) | e.g. `com.wysdomsolutions.henchgoblin` |
| `working-directory` | `src` | |
| `xcode-version` | `latest-stable` | Apple requires latest SDK for App Store upload |

### 4.2 Secret contract (canonical — the migration cost)

Consolidation forces **one** canonical secret name set. Reconciled from the two variants;
hench-goblin's names win as the reference. Each repo renames its secrets to match (one-time,
via `gh secret set`), then `secrets: inherit` passes them through.

**Android:** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` · (future Play) `PLAY_SERVICE_ACCOUNT_JSON`

**iOS:** `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_KEYCHAIN_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`, `APPLE_TEAM_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8`

**Test:** none required · `CODECOV_TOKEN` optional (only when `upload-codecov: true`)

> ⚠️ fuzz-noise's Android secrets (`ANDROID_UPLOAD_*`) must be re-set under the canonical names during its migration, or its release breaks.

## 5. Design decisions

1. **Manual versioning from `app.json` stays.** `versionName` from the git tag; `versionCode`/`buildNumber` read from `app.json` (source of truth — deterministic, survives re-runs). Tag must equal `app.json.version` or the build fails fast. Keep the strict-semver regex guard (injection-safe). Extract this into the `resolve-version` composite action so both platforms share it.
2. **Ref pinning:** callers pin `@v1` (a moving major tag). Start on `@main` during the pilot, cut `@v1` once proven, then move callers to `@v1`. Consider `@<sha>` for maximum reproducibility later.
3. **Bake in the no-src-PR gate (fuzz-noise#103).** The shared test workflow drops trigger-level `paths:` filtering in favor of a **changed-files gate** (`dorny/paths-filter` or `git diff`): the workflow always triggers, reports a green required check every time, but runs the heavy steps (`npm ci`, type-check, lint, tests) *only* when `src/**` changed. Fixes the required-check deadlock on docs/design-only PRs for **every** consumer at once — no per-repo branch-protection surgery.
4. **Bake in Gradle cache persistence (fuzz-noise#82)** in the shared Android workflow (`gradle/actions/setup-gradle@v4` with write-enabled cache on `main`).
5. **Grow into store auto-deploy (#150 / fuzz-noise#74), don't block on it.** Ship build+sign first. The `publish-to-play` input + `PLAY_SERVICE_ACCOUNT_JSON` secret are the seams for the later `r0adkll/upload-google-play` step (internal track, tag-only). iOS already auto-uploads to TestFlight; auto-assigning to the internal group + export-compliance handling is a follow-up.
6. **Standardize `defaults.working-directory: src`** (drop glass-buddy's per-step `cd src`).

## 6. Related & out of scope

- **Sibling infra — `hench-goblin#88`:** extract the `with-android-release-signing` Expo config plugin into a published package (`@wysdomsolutions/expo-android-release-signing`). Different deliverable (a registry package, not a workflow) but the same "de-dupe release infra" thrust. **Phase 2** — the reusable Android workflow can consume it once published. Track alongside this repo.
- **Out of scope — Godot/Codemagic:** crate-source-go builds via Codemagic + `chickensoft-games/setup-godot` (issues #124/#126/#127). A wholly different pipeline. If a second Godot game appears, spin a separate `godot-*` reusable family — do **not** stretch the Expo workflows to cover it.
- **Future test extension — `hench-goblin#151`:** E2E UI tests (Detox/Maestro). Design `expo-test.yml` to be extendable (or add a sibling `expo-e2e.yml`) later.

## 7. Migration plan (one repo at a time — nothing breaks until it opts in)

Creating this repo touches **zero** product repos. Each migrates on its own schedule:

1. **Build** the three reusable workflows + `resolve-version` composite in this repo; validate against hench-goblin's known-good YAML. Cut `@v1`.
2. **Pilot: fuzz-noise** — the second-most-mature repo. Replace `test.yml` + `android-release.yml` with callers; re-set its Android secrets under canonical names; add the net-new iOS caller (once iOS signing secrets exist). Prove identical artifacts on a throwaway tag. Close/relate fuzz-noise#103, #82, #74.
3. **hench-goblin** — migrate to callers (it *is* the reference, so mostly a secret-name no-op). Closes #89.
4. **glass-buddy** — adopt test caller (toggle lint/format off initially, add scripts, flip on); add net-new Android + iOS callers.
5. **New apps** — start from the caller templates from day one (this is the pull-cord payoff).

## 8. Open questions / next actions

- [x] **Home:** public `wysdom-solutions/wysdom-ci`, hardened. Settled 2026-07-10.
- [x] **Name:** `wysdom-ci` (name-storm 2026-07-10; runner-up `shipyard`).
- [ ] Create the repo (public, hardened: issues/wiki/projects off, ruleset on `main`, fork-PR approval) + author the three workflows + composite action (next build session).
- [ ] Confirm glass-buddy's `src` package.json has `lint`/`format:check` scripts (or plan to add) before flipping those toggles on.
- [ ] Decide `resolve-version` as a composite action vs. inlined per workflow (composite = true single-source, slightly more indirection).
