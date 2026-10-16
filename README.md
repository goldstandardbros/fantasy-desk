# Fantasy Desk

Standalone historical fantasy football draft and season replay pilot.

## Deployment

Static site on Render. Publish directory: `.`. Build command: `echo Static site`.

## Current pilot

The tested local Sprint 14 build must be uploaded before creating the public site. Required assets include `launch.html`, `time-machine.html`, `index.html`, `historical.js`, `players.js`, and `engine.js`.

NFLI and Betline remain separate; no production services are modified.

## 2026 roster data pipeline

The live site currently uses a **2025 historical player directory** for autocomplete and retrospective research. It does **not** assert that 2025 teams, player positions, or fantasy points are current.

A separate `data/players-2026.json` file is initially empty with `status: not-populated`. The manual ingestion command is `python scripts/build_2026_players.py`. It requests all 32 ESPN public team rosters, requires an explicit 2026 season and a minimum completeness threshold, and aborts rather than writing a partial dataset. Each record includes a source URL and UTC verification timestamp. The script has **not yet been run or validated against live 2026 responses**. No scheduled data refresh or automatic publication is configured. Verify source usage rights and response structure before automating.

Do not describe the 2026 data as live, verified, or connected until the ingestion has actually succeeded and the consumer pages are wired to it.
