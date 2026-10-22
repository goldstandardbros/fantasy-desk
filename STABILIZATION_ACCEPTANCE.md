# Fantasy Desk stabilization acceptance gates

Status: IN PROGRESS. No feature expansion and no production changes until these gates pass.

## Gate 1 — Release identity
- [ ] Record main SHA, production deploy SHA, deploy status and timestamp.
- [ ] Deploy only reviewed changes after backup and smoke tests.
- [ ] Verify all entry routes: index, My Teams, Player Research, Time Machine, Draft Lab.
- [ ] Verify mobile viewport and navigation; no regressions to My Teams.

## Gate 2 — User data integrity
- [ ] Export original browser teams before any migration.
- [ ] Restore backup in isolated browser profile; verify both leagues, rosters, starters, bench, IR, and scoring.
- [ ] Save, reload, restart browser, export/import round trip.
- [ ] Never automatically overwrite browser data or treat old backup as newest.
- [ ] Handle localStorage quota and malformed backups without losing prior data.

## Gate 3 — ESPN and current data
- [ ] Establish authorized access to both private ESPN leagues.
- [ ] Verify team/league identity and PPR scoring with owner.
- [ ] Reconcile all 32 current NFL rosters and timestamps; fail closed on partial results.
- [ ] Spot-check injury, transaction, week, opponent, and bye freshness.
- [ ] Label historical 2025 data explicitly; no fabricated 2026 stats.

## Gate 4 — NFLI read-only integration
- [ ] Document versioned NFLI data contract and provenance.
- [ ] Verify player/team/game identifier mapping and unmatched records.
- [ ] Validate source cutoffs, projection version, freshness, and calibration state.
- [ ] Display missing/stale/research-only data without recommendations.
- [ ] Run regression tests on every breaking NFLI schema change.

## Gate 5 — End-to-end acceptance
- [ ] Team selection -> current roster -> player research -> comparison -> lineup/waiver decision.
- [ ] Confirm changes survive refresh; ESPN writes only after explicit authorization.
- [ ] Exercise empty, stale, offline, unauthorized, and partial-data paths.
- [ ] Verify production behavior on iPhone and desktop.
- [ ] Record test evidence, failing steps, owner and next repair action.

## Operational cadence
Monday and Thursday integration audits check GitHub/Render drift, ESPN/NFL freshness and NFLI compatibility. Audits are read-only; no unattended deployments or user-data changes.

## Known initial blockers (2026-10-21)
- Production Render deploy SHA 757018293bd83d1b024e345e824c65d6ec991fac; GitHub main was 729d3128a093c5d29b5b8a0266a5eff3707ff9d2 at audit.
- Static site and browser-local team storage; cross-device persistence is not implemented.
- Private ESPN league synchronization is not verified.
- NFLI consumption is not demonstrated in deployed Fantasy Desk.
- Live 2026 roster ingestion and user-device acceptance remain unverified.

## October 21 additional repair evidence
- Added duplicate NFL abbreviation validation and missing-athlete-ID normalization on the stabilization branch.
- Added duplicate-abbreviation regression test; execution in this session is **not verified** because the local runtime cannot resolve github.com to retrieve the repository. Do not mark this test passed until it runs in a network-enabled checkout.
- Published 2026 catalog on main was `not-populated` with zero players at inspection; no live roster snapshot has been published.
- No production deployment or personal roster modifications performed.

## October 21 isolated regression execution
- Reconstructed the stabilization branch's ingestion script and test module in an isolated local checkout from connector-returned source text.
- Ran `python -m unittest discover -s tests -v`: **6 tests passed** (synthetic fixtures, 0.019 seconds). No GitHub Actions minutes used.
- Attempted live ESPN public roster request from the local runtime; DNS failed (`Temporary failure in name resolution`). Live ingestion remains **not verified**.
- Production and user rosters were not modified.

## October 21 strict athlete completeness repair
- Changed ingestion to fail closed when any athlete lacks an ID, name or position, rather than silently dropping that record.
- Added synthetic regression test `test_reject_missing_athlete_id` (pending execution).
- No current-season dataset was fabricated or deployed. Live ESPN access, private league access, and NFLI bridge remain unverified.

## My Teams browser persistence repair
- Backup import now writes storage before changing the in-memory team selection; failed storage writes preserve the previous in-memory teams.
- Restored selected-team IDs are checked against imported team IDs; invalid selections become null.
- Existing browser data is shape-checked before loading; malformed records fall back to an empty in-memory state without overwriting the original stored bytes.
- These are branch-only code changes. Real browser backup round-trip, storage quota, and iPhone persistence acceptance remain unverified; no production deployment.

## Browser safety follow-up
- Startup loading now checks roster length and player row shape before rendering; malformed saved data is not automatically overwritten.
- Restore confirmation explicitly asks for a current backup export first.
- Backup import now rejects duplicate team IDs, duplicate normalized player names, empty names and invalid player positions before confirmation.
- All changes remain on the stabilization branch; browser execution, cross-device persistence and production acceptance are pending.

## October 22 three-task roster compatibility sprint
- Expanded shared player validation to include standard NFL defensive, line and special-teams positions so full-team roster snapshots are not rejected solely for nonfantasy players.
- Player Research now filters verified full-roster snapshots to QB/RB/WR/TE/K/D-ST for fantasy-facing search, while retaining the complete snapshot for integrity checks.
- Added synthetic regression `test_full_roster_includes_nonfantasy_positions`; committed but not executed in this session.
- Caveat: ESPN may return additional position abbreviations; live schema/roster validation remains necessary. No production release or private ESPN sync verified.

## October 22 ESPN identity contract sprint
- Shared player identity validation requires `espn:<numeric athlete ID>` and a nonempty NFL team.
- Python ingestion now rejects nonnumeric ESPN IDs and blank names/positions, matching browser-side assumptions.
- Added synthetic regression cases for invalid ESPN IDs and blank athlete names; not executed in this sprint.
- Remain blocked on real ESPN 2026 roster verification, browser acceptance, private league authorization and NFLI integration. No production changes.

## October 22 roster publication integrity sprint
- Catalog publishing now writes and fsyncs a temporary file in the destination directory, then atomically replaces the catalog; failed validation does not touch the previous file.
- Added regression test verifying a 2025-source rejection preserves an existing catalog. Test execution remains pending.
- Team listing now rejects missing, nonnumeric or duplicate NFL team IDs before fetching 32 rosters.
- All work is committed to stabilization branch only; live provider, browser acceptance and production release remain unverified.

## Operational repair: My Teams safety (October 22)
- Startup validation now rejects unsupported fantasy positions in persisted roster entries.
- Backup import checks file presence and refuses files larger than 2 MiB before parsing, retaining the existing transactional storage write and explicit replace confirmation.
- Chromium exists locally, but navigation to a minimal data URL returned `net::ERR_BLOCKED_BY_ADMINISTRATOR`; this is not a passed browser acceptance test.
- ESPN live roster fetch and Render site browser navigation are not verified in this environment. Keep stabilization branch separate from production until browser acceptance, real data coverage, and end-to-end My Teams persistence are verified.
