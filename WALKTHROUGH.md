# Browser walkthrough

Serve the repository over HTTP(S) as described in [README](README.md), then open the site root. The browser loads the manifest first and fetches the chosen dataset and map asset. If JSON or assets fail to load, use the displayed error/retry state and check that the server is serving the site-root-relative `data/` and `assets/` paths; opening `index.html` directly as a local file is not supported.

## Explore a match

1. Choose a map and source date with the filters. The match selector supports an individual match and an all-matches view; selections are constrained by the available data. Match IDs are preserved in full, including suffixes.
2. The minimap shows movement samples as paths: solid human paths, dashed bot paths, and distinct event symbols. Hover a path or hover/focus a marker for its details; use the event list to jump to a recorded event. Paths connect sampled observations, not an exact replay of continuous movement.
3. Use the playback controls below the map to move the elapsed-time cursor through events and paths. A selection starts at its end to show the full journey; press Play to restart it. In all-matches mode, the cursor is shared in seconds since each match's own start; it does not mean matches occurred simultaneously. Scrubbing shows paths and markers recorded at or before that elapsed time; the event list also lets you jump to later moments. The summary counts journeys and event records, not unique players or independently verified outcomes.
4. Drag the map to pan, use the zoom buttons or wheel to inspect an area, and select Fit to return to the overview. The map retains its native aspect ratio; out-of-map samples are counted as clipped rather than clamped to the edge.

## Heatmap multiselect and comparative overlay

1. Use the **Heatmap Layers · Multiselect** chips below the minimap (`◈ Traffic`, `⚔ Kills`, `☠ Deaths`, and `Off`).
2. Selecting a single layer displays its density gradient (Traffic in teal, Kills in coral, Deaths in violet).
3. Selecting multiple layers triggers an automatic composite overlay (e.g. Traffic + Kills, or all 3 layers simultaneously). The status badge indicates active comparative state (`⚡ Comparing 2 layers` / `⚡ Comparing 3 layers`), allowing designers to correlate player rotation corridors with combat kill zones.
4. Clicking the metric cards in Section 04 ("JOURNEYS", "KILL RECORDS", "DEATH RECORDS") also directly toggles the respective heatmap layers with active border glows.
5. Pressing **Off** clears all heatmap layers back to path vector view.

## Section 05: Level Intelligence & Combat Feed

Section 05 transforms high-volume match signals into actionable level pacing analytics across three dedicated views:

- **📊 Insights** (Default):
  - **Pacing & First Contact**: Displays time to First Blood, Peak Combat Minute (with clash event count), and Combat Tempo (kills/min). Clickable `⌖ Jump` buttons scrub the playback timeline directly to these moments.
  - **Phase Distribution (0–3m / 3–8m / 8m+)**: Visual segmented progress bar representing the proportion of combat engagements occurring in Early infiltration, Mid-game circle compression, and Late-game endgame.
  - **Lethality & Threat Dynamics**: Analyzes Human vs Bot kill share and environmental Storm casualties as a percentage of total deaths.
- **✦ Smart Analysis (AI Level Co-Pilot)**:
  - Synthesizes complex match telemetry into tactical level layout recommendations upon clicking **Analyze match data**.
  - **Local Ollama Inference**: Automatically detects if Ollama is running locally (`http://127.0.0.1:11434`) and streams live generation from local models (e.g. `llama3.2`) with private, on-device inference and zero cloud telemetry leakage.
  - **Deployed / Offline Fallback**: When deployed to the web or when Ollama is offline, explicitly informs the user that a local Ollama connection is required for live inference and streams a tailored simulated level intelligence summary based on the active match's telemetry metrics.
  - **Typewriter Effect**: Streams output with a typewriter cadence and blinking cursor as tokens/characters arrive, finishing with clean markdown formatting and one-click copy.
- **⚔ Combat Feed**:
  - Automatically filters out the hundreds of repetitive `Loot` events, surfacing exclusively high-signal combat milestones: `Kill`, `BotKill`, `Killed`, `BotKilled`, and `KilledByStorm`.
  - Every combat row is clickable, instantly moving the timeline cursor to that firefight.
- **📜 All Signals**:
  - The complete raw telemetry stream with a type filter dropdown (`All signals`, `Combat only`, `Loot only`, `Storm deaths`) for granular signal verification.

## Read the telemetry view responsibly

Player labels are stable pseudonyms (`HUMAN-…` / `BOT-…`), not anonymous identities. They can link records across matches in this dataset, but repeated bot source IDs do not prove a single bot identity. Match IDs remain unmodified. Treat the tool and its data as sensitive production telemetry; share only with authorized viewers, and use access-controlled/private hosting where appropriate.