# CLAUDE.md

Guidance for Claude Code when working in **wysdom-ci**.

## What this repo is

Shared CI for Wysdom Solutions' Expo React Native apps: reusable GitHub Actions
workflows + one composite action, called by each product repo so a build-step fix in one
place propagates to every consumer on its next version bump. `DESIGN.md` holds the settled
rationale and contracts (that design is the impetus; this repo is the result).

## Structure

```
.github/
  workflows/
    expo-test.yml            reusable: type-check + lint + format + coverage, changed-files gate
    expo-android-release.yml reusable: prebuild + signed AAB, optional Play upload, draft release
    expo-ios-release.yml     reusable: prebuild + archive + TestFlight, draft release
    selftest.yml             in-repo proof harness driving the fixtures
  actions/
    resolve-expo-version/    composite: version resolve + guards (the ONLY composite)
  dependabot.yml
fixtures/
  expo-app/                  dependency-free Expo-shaped fixture for expo-test
  app-json-cases/            valid / mismatch / missing / injection cases for resolve-expo-version
DESIGN.md                    settled design + inputs/secret contracts
BACKLOG.md                   deferred work to file as issues once the repo is live
```

## Conventions

- **Composite vs inline — the duplicate-inline watchout.** Only `resolve-expo-version` is a
  composite (shared by both release workflows, and security-sensitive). Other small logic
  (changed-files gate, apply-version-to-app.json, attach-to-release) is inlined *on purpose*,
  trading a little duplication for a smaller trust surface. **Watch for this to flip:** if an
  inline block gets copied a third time, or grows non-trivial, promote it to a composite under
  `.github/actions/`.
- **Security — this repo is a chokepoint.** Its reusable workflows run in each consumer's
  context with that consumer's signing secrets, so a bad dependency here has multiplied blast
  radius. Therefore:
  - SHA-pin every non-`actions/*` third-party action (`uses: owner/repo@<40-char-sha> # vX.Y.Z`).
  - Least-privilege `permissions:` on every workflow (`contents: read` for test; `contents:
    write` only where a release artifact is attached).
  - Never store secrets here — they arrive via `secrets: inherit` from the caller.
  - Prefer an inlined CLI step over pulling an action for trivial logic.
- **Self-contained.** Keep everything here free of links/paths to sibling repos, private docs,
  or external issue trackers.
- **Docs.** Each composite: full input/output descriptions in `action.yml` + a folder README.
  Workflows: a header comment block + the top-level README.

## Verifying changes

No live repo or secrets yet, so verification is static:
- Confirm YAML parses; run `actionlint` if available.
- `selftest.yml` is the offline proof harness — it drives `expo-test` and `resolve-expo-version`
  against `fixtures/`. The fixtures are dependency-free, so they run without a network install.
- Full Android/iOS signing is only provable on a real tagged release with real secrets — deferred
  until the repo + secrets exist.

## Workflow versioning

Callers pin `@v1` (a moving major) once it's cut; during the pilot they use `@main`. Inside the
release workflows, the composite is referenced with `./.github/actions/resolve-expo-version`, which
resolves to this repo at the same ref the reusable workflow was called with.
