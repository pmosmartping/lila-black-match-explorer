# Architecture

Python with PyArrow and Pillow prepares static JSON and optimized minimaps; a vanilla JavaScript/SVG browser app renders them. This avoids a runtime API, database, frontend build, and third-party services. Serve the files over HTTP(S), not `file://`.

## Data flow and contract

The pipeline reads extensionless Parquet files, decodes event bytes, and combines journeys by map and match. It removes byte-identical duplicate journeys and rejects conflicting repeats. A match is included in every source-date folder where it appears: one match therefore appears on two dates, but is reconstructed once. The browser loads `data/manifest.json`, then the selected map/date JSON and WebP. Each match contains players with sorted `[seconds, u, v, event]` records; seconds are relative to the match's earliest recorded event.

Numeric source IDs are classified as bots; other IDs as humans. Stable SHA-256 pseudonyms replace player IDs in site JSON, but are linkable and not anonymous. Match IDs remain intact; repeated numeric bot IDs do not prove persistent identity.

## Map coordinates

For world coordinates `(x,z)`, use `u=(x-origin_x)/scale`, `v=1-(z-origin_z)/scale`; `y` is elevation. The `1-` flips the vertical axis to the image's top-left origin. Multiply `u` and `v` by the displayed image width and height. Out-of-bounds coordinates are retained, not clamped.

Origins and scales: Ambrose Valley `(-370,-473), 900`; Grand Rift `(-290,-290), 581`; Lockdown `(-500,-500), 1000`. For Ambrose `(-301.45,-355.55)`, the image fraction is `(0.0762, 0.8695)`; on a 1024-pixel image this is approximately `(78,890)`. Contrary to the supplied README, source images are 4320×4320, 2160×2158, and 9000×9000 respectively. WebP derivatives preserve aspect ratio and are capped at 2048 pixels.

## Interpretation and tradeoffs

Although `ts` is typed `timestamp[ms]`, its raw integers appear to be Unix **seconds**: `1770754537` corresponds to 2026-02-10 20:15:37 UTC, and adjacent positions commonly differ by 5 units. We infer seconds and subtract the first recorded timestamp; the date filter uses source folders. Playback across matches aligns these relative starts, not wall-clock time.

`BotKill` and `BotKilled` also appear on bot journeys, contrary to the source README's human-centric descriptions. Actor/target attribution is unverified, so the UI displays source labels, not inferred opponents or outcomes.

| Decision | Tradeoff |
|---|---|
| Static files and client-side filtering | Simple hosting; browser bandwidth and memory grow with data. |
| Lines between sampled positions | Useful route approximation, not continuous telemetry. |
| Unsmoothed grid counts | Transparent heatmaps; traffic counts samples, not unique players or dwell time. |
| Pseudonymized public export | Convenient sharing; production telemetry and match IDs remain visible and require authorization. |