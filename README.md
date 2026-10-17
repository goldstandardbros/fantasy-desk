# Fantasy Desk

Fantasy football team management and player research, with separate optional historical games.

## Deployment and current state

This repository is a static site. Publish directory: `.`; build command: `echo Static site`.

`index.html` is the current entry page. Do not require `launch.html` for deployment: it is absent from the current default branch. Historical references to a Sprint 14 launch flow are not verified as the deployed experience.

Current entry points include `my-teams.html`, `player-research.html`, `time-machine.html`, and `draft-lab.html`. The team management interface currently stores data locally in the browser; ESPN synchronization and screenshot import must not be claimed as working without live end-to-end verification.

## Recovery and compatibility

Preserve the original Fantasy Desk team-management experience and both ESPN league identities. Never substitute Time Machine or Draft Lab for My Teams. Treat the October 16, 2026 `fantasy-desk-backup.json` export as a recovery candidate, not automatically as newer than live browser state. Verify roster completeness, scoring configuration, screenshot attachments, and import behavior before restoration. Do not overwrite user data without explicit approval.

NFLI and Betline remain separate applications. Their integration is research-only until source freshness, validation and connectivity are demonstrated.

## 2026 roster data pipeline

The historical `players.js` directory contains 2025 season data and must not be presented as verified 2026 statistics or roster status.

`data/players-2026.json` and `scripts/build_2026_players.py` support a separate provenance-aware roster ingestion workflow. The ingestion requires all 32 ESPN public team rosters, an explicit 2026 season, a completeness threshold, source URLs and verification timestamps. A partial or stale response must fail closed. The existence of code or a commit is not proof that live ingestion succeeded.

Run `python -m unittest discover -s tests -v` for offline synthetic-fixture validation. Live ESPN ingestion, representative spot checks, and deployed-page validation are separate gates. No GitHub Actions automation is required or approved.

## Recovery acceptance checks

1. Verify deployed build identity against the default-branch commit.
2. Import a copy of the October 16 backup into an isolated test context; never replace the only saved roster.
3. Confirm both teams, scoring rules, starters, bench, IR, and screenshots survive export/import round trip.
4. Verify mobile screenshot upload and explicit user review before roster changes.
5. Confirm 2026 research is source-verified and freshness-labeled; historical fallbacks are clearly identified.
