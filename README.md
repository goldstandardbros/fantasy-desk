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


## Local lineup planning guardrails

My Teams uses an explicitly labeled **local planning template**, not imported league settings. Named slots accept their named position; FLEX accepts RB/WR/TE. Superflex is not declared or inferred. Bench has no league-capacity validation. Occupied starters must be moved to Bench explicitly before replacing them. Add, move and text import validate before saving; bulk imports are all-or-nothing. Stable player IDs are retained when a directory match supplies one, with conservative normalized-name fallback for older/manual entries. Ambiguous names are rejected for review, never merged or deleted.

New IR placements remain unavailable: neither league IR rules nor current player eligibility are connected. Recovery backups may retain existing IR placements, clearly marked unverified. Existing saved invalid lineups are shown for review and are not silently rewritten. Backup validation rejects duplicate team/player identities and incompatible starter slots before replacement, while preserving other backup metadata.

No verified game-start source/timestamps or live league contract exist in this app, so **game locks, scoring and actual league eligibility are not checked**. These guards only protect a local plan; they do not enable ESPN transactions, player recommendations or current-season data claims. `data/players-2026.json` remains unpopulated.

Offline checks: `node --test tests/lineup-rules.test.cjs tests/my-teams-handlers.test.cjs` and `python -m unittest discover -s tests -v`. The handler suite executes the actual page scripts with a minimal DOM adapter, not a browser. Browser fixture checks in `tests/my-teams-ui.test.cjs` additionally require Playwright and Chromium (`CHROMIUM_PATH` may select an installed executable); they use an isolated local server/browser and synthetic roster names, not an owner's saved data. Run with `node --test tests/my-teams-ui.test.cjs` when those optional tools are available. No CI workflow or provider fetch is introduced.

## Source-athlete catalog contract (schema 2)

`players-2026.json` is a **full source-athlete roster**, not a list of fantasy-eligible players. A successful builder retains offensive line, defense and every other supplied position. The existing completeness gates remain 32 distinct team sources, at least 20 athletes per team and at least 1,000 source athletes overall. Each athlete retains its ESPN ID, explicit 2026 season, team ID/abbreviation, original team-roster source URL and that source's checked timestamp. Generation time follows the team checks. Missing identity fields, duplicated IDs or incomplete sources reject the build.

`fantasyPositions` explicitly declares QB/RB/WR/TE/K for the current UI projection. `player-catalog.js` validates the full source contract, then returns both the unchanged full athlete list and a separate nonempty supported-position projection. The 1,000-athlete threshold is not incorrectly applied to this smaller view. D/ST is not fabricated from individual defenders. Distinct current source IDs with the same normalized name remain in the catalog; My Teams omits those ambiguous names from autofill rather than selecting the first identity.

Both My Teams and Player Research use the same validator. They display the snapshot date and both counts; no fantasy scores, games, current transaction status, ranking, injury or league eligibility is inferred. The shipped `data/players-2026.json` remains the unchanged empty placeholder until a separately authorized real ingestion succeeds. These contract checks are not evidence that live source data has been fetched or independently authenticated.

Additional offline tests: `node --test tests/player-catalog.test.cjs tests/catalog-consumers.test.cjs` plus the existing Python test command. These build a 1,280-athlete **synthetic** mixed-position fixture through the actual Python builder and execute both real page consumers through a minimal DOM adapter; they do not contact ESPN or populate the shipped catalog. Browser rendering/live ingestion remain separate checks.

## Dated observed directory (separate from a complete roster)

When the ESPN full-roster file is unpopulated, the pages may load `data/players-2026-observed.json`. Its separate contract is `catalogKind: nflverse-depth-observed-directory`, `status: dated-source-observations`. It **cannot pass the ESPN full-roster validator**. This directory supports discovery and local planning only, not active status, fantasy scoring, injuries, recommendations or actual league eligibility.

The included local candidate was adapted offline from retained [nflverse depth-chart](https://github.com/nflverse/nflverse-data/releases/tag/depth_charts) and [identity registry](https://github.com/nflverse/nflverse-data/releases/tag/players) captures. Latest shared observation: **2026-10-29 06:01:40 UTC**. It contains 2,308 source role observations across 32 observed teams, 1,995 observed ESPN IDs, 1,988 exact dual-ID registry matches, and 7 unresolved identities excluded from discovery. The QB/RB/WR/TE/K view has 627 identities. All other positions and the complete selected role rows remain in the file. These numbers are source observations, not a complete active NFL roster or eligible user-league lineup.

Only exact source GSIS-field **and** ESPN ID agreement with one registry row admits an identity. Names are never used to repair an ID gap. Original source ID values are opaque and preserved verbatim: one GSIS-field value has a nonstandard shape but agrees exactly in both retained sources; no official-ID format or canonical model identity is asserted. Missing or conflicting joins are listed under `unresolved`. Saved manual plans retain a dated directory-evidence reference when autofilled, without turning that evidence into live eligibility.

The offline builder `scripts/build_observed_directory.py` accepts explicit local capture/receipt paths, verifies original SHA-256/byte counts and timestamps, selects the latest shared observation without borrowing missing teams from older cuts, retains original source URLs, and writes a new output only after validation. It has no network code. No source acquisition, ESPN synchronization or current-player ranking is enabled by loading this static file. The original full-roster placeholder remains empty because the retained latest weekly-roster source covers only 28 teams; the observation directory does not override that gate.

Attribution: **nflverse contributors**, [nflverse-data](https://github.com/nflverse/nflverse-data), [CC BY 4.0 license](https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md). Changes: latest shared depth observation selected; exact GSIS/ESPN registry join; supported-position discovery view; unresolved identities excluded. No endorsement is implied. Original retained source hashes, URLs, source update times and capture times are embedded in `sourceReceipts`; license and change notice are embedded and shown in both pages.

Offline validation additionally runs `node --test tests/observed-directory.test.cjs tests/catalog-consumers.test.cjs` and the Python suite. The actual-file consumer case loads the candidate's real retained-source output; other fixtures are clearly synthetic. These tests execute page scripts with a DOM adapter, not browser rendering. Publication and live deployed verification remain separate gates.
