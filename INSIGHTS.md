# Gameplay insights from the LILA BLACK sample

The findings below use globally deduplicated source events and unique matches. Each design proposal is a hypothesis to test, not a conclusion established by this dataset.

## 1. Bot combat labels dominate, but journey attribution is ambiguous

**Observed:** The deduplicated sample contains 3,115 combat-label rows: 2,410 `BotKill`, 699 `BotKilled`, 3 `Kill`, and 3 `Killed`. Filename-derived journey type is not the same as event actor: 2,227 `BotKill` rows occur on HUMAN journeys and 183 on BOT journeys; 402 `BotKilled` rows occur on HUMAN journeys and 297 on BOT journeys. `Kill` and `Killed` each appear 3 times, all on HUMAN journeys.

**Design hypothesis:** If actor/target telemetry confirms that the HUMAN-journey `BotKill`/`BotKilled` labels are actual player-vs-bot encounters, bot encounter pacing or challenge may be a productive tuning area. Validate event attribution first, then A/B-test one encounter-tuning change.

**Evaluate with:** Record explicit actor and target types; compare validated bot/human combat outcomes per 100 fully observed matches, plus completion and retention across variants.

**Caveat:** The source labels alone do not identify the event actor or victim, and BotKill/BotKilled rows occur in BOT journeys despite the README descriptions. These counts cannot be interpreted as unique encounters, kill/death totals, or proof that bot combat is the dominant player experience.

## 2. Loot-event positions cluster in localized movement areas

**Observed:** There are 12,866 deduplicated `Loot` rows across 737 of 796 unique matches (92.6%). I transformed each row's recorded player position to map UV coordinates using the README map origins/scales, then divided the in-bounds `[0,1] × [0,1]` area into a 10×10 grid. All `Loot` positions are in bounds. The busiest grid cell contains 13.25% of Ambrose Valley's loot-event positions, 11.02% of Grand Rift's, and 11.56% of Lockdown's.

**Design hypothesis:** Test whether modestly redistributing loot opportunities or route incentives reduces repeated congregation in the busiest cells without suppressing looting.

**Evaluate with:** Compare the top-cell share and grid-cell entropy of `Loot` event positions, pickups per fully observed match, and engagement/retention across randomized variants. Keep coordinate bounds and observation coverage consistent.

**Caveat:** These are positions recorded with `Loot` events, not item spawn locations or proof that a location contains more valuable loot. Clustering may reflect player routes, event coverage, or other factors; it is not evidence of an item-placement imbalance by itself.

## 3. Storm-death event rows vary by map, but do not establish map danger

**Observed:** The globally deduplicated data contains 39 `KilledByStorm` rows: 17 among 566 Ambrose Valley matches (3.00 per 100), 5 among 59 Grand Rift matches (8.47 per 100), and 17 among 171 Lockdown matches (9.94 per 100).

**Design hypothesis:** The higher observed row rates on Grand Rift and Lockdown warrant a controlled test of storm-route readability or warning timing on those maps—not an assumption that either map is inherently more dangerous.

**Evaluate with:** In complete, consistently instrumented matches, compare storm deaths per 100 matches and by match phase before and after a warning/route change; also measure extraction completion and time-to-extract. The supplied event vocabulary has no extraction-completion event, so this dataset cannot measure that outcome.

**Caveat:** Grand Rift has a small sample, the final source day is partial, and per-match coverage is not independently verified. These event-row counts must not be presented as map-level risk rates.

## Measurement and identity notes

- The pipeline read 1,243 journey-file paths and removed one byte-identical repeated player/match file, leaving 1,242 unique journeys and 89,016 unique event rows. These form 796 global unique matches.
- One match occurs in both February 10 and February 11 source folders. It is reconstructed once globally, then the complete match is included in each of those source-date datasets. Thus the manifest has 797 date-scoped match entries for 796 unique matches; `date` means a source folder in which the match appeared. Do not sum event rows across date datasets to calculate global totals, because that cross-date match is intentionally present in both.
- Although the Parquet schema labels `ts` as `timestamp[ms]`, the raw int64 values are Unix seconds: for example, `1770754537` is `2026-02-10T20:15:37Z`. The pipeline uses raw integer differences in seconds from the earliest recorded timestamp in each global match. The 796 observed spans have a median of 382 seconds (range 13–890); 71,754 consecutive within-journey movement intervals have a median of 5 seconds and a 90th-percentile interval of 10 seconds. Duration is the observed sample span and does not establish complete match coverage.
- Player IDs in generated site JSON use stable SHA-256-derived `HUMAN-` or `BOT-` pseudonyms, classified from the original UUID/numeric ID before hashing. This is pseudonymization, **not anonymization**. Numeric bot source IDs recur: 81 of 94 numeric IDs appear in more than one global match (448 of 461 ID/match associations belong to reused IDs). A stable pseudonym represents a repeated source ID only; the data does not establish that it represents the same bot entity across matches.
