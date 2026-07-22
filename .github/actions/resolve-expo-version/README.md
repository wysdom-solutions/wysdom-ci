# `resolve-expo-version`

Resolve and validate an Expo app's release version identity from `app.json` and the
triggering git ref, and emit the identifiers a native build needs.

It is a **guard, not a passthrough**. On a tag build it fails fast when the tag and
`app.json` disagree, and it rejects any version string that isn't strict-semver-shaped
(injection-safe). It is **Expo-only** — it reads `app.json`, so it does not apply to
.NET, Godot, or other project types.

## Version model

- `versionName` comes from the **git tag** (leading `v` stripped) on a tag build, else the
  optional `input-version`, else `app.json` `.expo.version`.
- On a tag build, the resolved version is **cross-checked** against `app.json` `.expo.version`
  and the run fails if they differ.
- `versionCode` / `buildNumber` come from `app.json` **only** — there is no override.

## Inputs

| Input | Default | Description |
|---|---|---|
| `working-directory` | `src` | Directory containing `app.json`. |
| `tag` | `${{ github.ref_name }}` | Ref name that triggered the run; source of the version on a tag build. |
| `ref-type` | `${{ github.ref_type }}` | `tag` or `branch`; `tag` enables the cross-check. |
| `input-version` | `''` | Optional manual override (e.g. a `workflow_dispatch` input); used only on non-tag builds. |

## Outputs

| Output | Description |
|---|---|
| `version` | Resolved, validated version name (e.g. `1.2.3`). |
| `version-code` | Android `versionCode` from `app.json` (`.expo.android.versionCode`). |
| `build-number` | iOS `buildNumber` from `app.json` (`.expo.ios.buildNumber`). |

## Usage

```yaml
- id: version
  uses: wysdom-solutions/wysdom-ci/.github/actions/resolve-expo-version@v1
  with:
    working-directory: src

- run: echo "Building ${{ steps.version.outputs.version }} (vc ${{ steps.version.outputs.version-code }})"
```

## Failure modes

- `app.json` not found in `working-directory`.
- Version string fails the format guard `^[0-9]+(\.[0-9]+){0,2}([+-][A-Za-z0-9.]+)?$`.
- `.expo.android.versionCode` or `.expo.ios.buildNumber` missing from `app.json`.
- Tag build where the tag (minus `v`) does not equal `app.json` `.expo.version`.
