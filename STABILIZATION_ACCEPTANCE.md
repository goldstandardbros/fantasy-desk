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
