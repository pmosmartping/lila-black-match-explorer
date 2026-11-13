# Browser walkthrough

Serve the repository over HTTP(S) as described in [README](README.md), then open the site root. The browser loads the manifest first and fetches the chosen dataset and map asset. If JSON or assets fail to load, use the displayed error/retry state and check that the server is serving the site-root-relative `data/` and `assets/` paths; opening `index.html` directly as a local file is not supported.

## Explore a match

1. Choose a map and source date with the filters. The match selector supports an individual match and an all-matches view; selections are constrained by the available data. Match IDs are preserved in full, including suffixes.
2. The minimap shows movement samples as paths: solid human paths, dashed bot paths, and distinct event symbols. Hover a path or hover/focus a marker for its details; use the event list to jump to a recorded event. Paths connect sampled observations, not an exact replay of continuous movement.
3. Use elapsed-time playback controls to move the match cursor through events and paths. A selection starts at its end to show the full journey; press Play to restart it. In all-matches mode, the cursor is shared in seconds since each match's own start; it does not mean matches occurred simultaneously. Scrubbing shows paths and markers recorded at or before that elapsed time; the event list also lets you jump to later moments.
4. Drag the map to pan, use the zoom buttons or wheel to inspect an area, and select Fit to return to the overview. The map retains its native aspect ratio; out-of-map samples are counted as clipped rather than clamped to the edge.

## Read the traffic view responsibly

Choose **Traffic**, **Kills**, or **Deaths** in the heatmap control. Traffic counts `Position` and `BotPosition` samples; kills count `Kill` and `BotKill`; deaths count `Killed`, `BotKilled`, and `KilledByStorm`. Each is an unsmoothed grid of recorded samples up to the playback cursor. Higher traffic counts can indicate more recorded samples, not necessarily more players or longer presence: sampling frequency and coverage affect the result. Combat event names do not reliably expose both participants or prove causality, and no extraction or outcome should be inferred unless explicitly represented by the displayed data.

Player labels are stable pseudonyms (`HUMAN-…` / `BOT-…`), not anonymous identities. They can link records across matches in this dataset, but repeated bot source IDs do not prove a single bot identity. Match IDs remain unmodified. Treat the tool and its data as sensitive production telemetry; share only with authorized viewers, and use access-controlled/private hosting where appropriate.