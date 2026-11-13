# LILA BLACK match explorer

A static browser tool for exploring movement and recorded events in LILA BLACK production match telemetry. The browser reads generated JSON and minimap assets; Python prepares those files from the supplied Parquet source data.

**Live viewer:** <https://pmosmartping.github.io/lila-black-match-explorer/>. The deployed data is public and pseudonymized, not anonymous.

The visual design follows [LILA Games](https://lilagames.com/). The LILA mark and BLACK artwork in `assets/brand/` are sourced from its official site and remain the property of their respective rights holders. The bundled fonts use the SIL Open Font License; their license texts are in `assets/fonts/`.

## Quick start

Requirements: Python 3.10 or newer and a browser.

To rebuild, place the supplied `February_10/` through `February_14/` folders and original `minimaps/` folder at the project root. The hosted site contains generated artifacts, not the source Parquet files.

```sh
python -m venv .venv
```

Activate the environment:

```sh
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install the pipeline dependencies (`pyarrow` and `Pillow`) and build browser data from the repository root:

```sh
python -m pip install -r requirements.txt
python scripts/build_data.py --input-root . --output-dir data --minimap-dir assets/minimaps
```

The pipeline creates `data/manifest.json`, map/date dataset JSON, and aspect-preserving optimized WebP maps at `assets/minimaps/{AmbroseValley,GrandRift,Lockdown}.webp` (maximum edge 2048 pixels). The source Parquet folders and minimaps are inputs; the browser uses generated artifacts.

Serve the repository root locally (do not open `index.html` as a `file://` URL):

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000/>. The server must serve JSON and WebP files from the site's relative paths. Stop it with Ctrl-C.

## Deployment

After generating `data/` and `assets/`, deploy the static site files (`index.html`, `styles.css`, `app.js`, `data/`, and `assets/`) to any static host that serves HTTP(S), JSON, and WebP with the directory structure intact. Build the artifacts locally or in a trusted deployment pipeline; the browser needs no Python runtime or API server. Keep hosting private or enforce access controls for authorized viewers. Do not publish production telemetry to an unrestricted public host without authorization.

There are no required environment variables, API keys, or runtime secrets. The browser fetches `data/manifest.json` relative to the site root; no deployment base-path setting is currently required, so host at the domain root or ensure relative paths remain valid.

## Data sensitivity and interpretation

The pipeline uses stable `HUMAN-…` and `BOT-…` SHA-256-derived pseudonyms in site data; source player IDs should not appear in the exported JSON. This is pseudonymization, **not anonymization**: identities can be linked across this dataset, and full match IDs remain. Generated map paths and events are still production gameplay telemetry. Restrict access, avoid sharing exports outside authorized contexts, and preserve the source dataset.

Positions are sampled observations, and the traffic overlay counts samples rather than continuous player presence. The original README's `BotKill`/`BotKilled` descriptions conflict with those labels appearing on bot journeys, so actor and target attribution is unverified; the viewer preserves the source event names. Match playback time is relative to each match's earliest recorded event. Despite the original README and Parquet `timestamp[ms]` type, raw timestamp values align with Unix **seconds** and yield plausible match durations when interpreted as seconds; see [Architecture](ARCHITECTURE.md) for the evidence. The date filter selects matches represented in a source folder; journeys for the same match are combined across folders and exact duplicate files removed. One match appears under two dates. Numeric bot IDs recur across matches, so a repeated bot pseudonym does not establish a persistent bot identity.

## Documentation

- [Browser walkthrough](WALKTHROUGH.md)
- [Architecture and data assumptions](ARCHITECTURE.md)
- [Evidence-backed design insights](INSIGHTS.md)
- [Source data-format specification (public copy)](DATA_FORMAT.md)

`DATA_FORMAT.md` documents the original Parquet schema, event types, map configurations, timestamps, and sample data. This public copy replaces the example human player ID with a synthetic UUID; the provided source README retains the original.
