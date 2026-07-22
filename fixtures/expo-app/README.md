# `fixtures/expo-app`

A minimal, **dependency-free** Expo-shaped app used by `selftest.yml` to exercise the
`expo-test.yml` reusable workflow end-to-end without any network install.

Its `package.json` scripts (`type-check`, `lint`, `format:check`, `test:coverage`) are
deliberate stubs. The fixture proves the **CI plumbing** — the changed-files gate, the
lint/format toggles, step sequencing, and the coverage artifact — not the tools
themselves (real tool behavior is covered by real consumer repos).

`package-lock.json` is hand-written for a zero-dependency package so `npm ci` succeeds
offline and deterministically.
