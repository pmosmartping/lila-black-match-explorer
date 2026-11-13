#!/usr/bin/env python3
"""Convert the supplied LILA BLACK parquet journeys into static site JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image

import pyarrow.parquet as pq

MAPS = {
    "AmbroseValley": (900.0, -370.0, -473.0),
    "GrandRift": (581.0, -290.0, -290.0),
    "Lockdown": (1000.0, -500.0, -500.0),
}
DAY_NAMES = {
    "February_10": "2026-02-10",
    "February_11": "2026-02-11",
    "February_12": "2026-02-12",
    "February_13": "2026-02-13",
    "February_14": "2026-02-14",
}
REQUIRED_COLUMNS = {"user_id", "match_id", "map_id", "x", "z", "ts", "event"}


def pseudonym(source_id: str) -> str:
    """Stable deterministic pseudonym; this is not anonymization."""
    prefix = "BOT" if source_id.isdecimal() else "HUMAN"
    digest = hashlib.sha256(source_id.encode("utf-8")).hexdigest()
    return f"{prefix}-{digest}"


def decode_event(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    if isinstance(value, str):
        return value
    raise ValueError(f"Unexpected event value: {value!r}")


def source_files(root: Path):
    for folder, iso_date in DAY_NAMES.items():
        day_dir = root / folder
        if not day_dir.is_dir():
            raise FileNotFoundError(f"Required source directory is missing: {day_dir}")
        for path in sorted(day_dir.glob("*.nakama-0")):
            # The first underscore separates user_id from match_id; UUIDs contain none.
            stem = path.name.removesuffix(".nakama-0")
            if "_" not in stem:
                raise ValueError(f"Invalid journey filename: {path}")
            source_id, match_id_stem = stem.split("_", 1)
            match_id = f"{match_id_stem}.nakama-0"
            if not source_id or not match_id:
                raise ValueError(f"Invalid journey filename: {path}")
            yield path, iso_date, source_id, match_id


def convert(root: Path, output: Path, minimap_output: Path) -> dict[str, Any]:
    # Reconstruct each match across source days, preserving the date folders in which it appeared.
    matches: dict[tuple[str, str], dict[str, Any]] = {}
    match_maps: dict[str, str] = {}
    match_dates: dict[tuple[str, str], set[str]] = defaultdict(set)
    player_match_files: dict[tuple[str, str], bytes] = {}
    player_match_maps: dict[tuple[str, str], str] = {}
    input_file_count = 0
    unique_file_count = 0
    duplicate_file_count = 0
    row_count = 0
    for path, iso_date, source_id, filename_match in source_files(root):
        input_file_count += 1
        player_match_key = (source_id, filename_match)
        source_bytes = path.read_bytes()
        previous_bytes = player_match_files.get(player_match_key)
        if previous_bytes is not None:
            if source_bytes != previous_bytes:
                raise ValueError(f"Conflicting repeated player/match file: {path}")
            map_name = player_match_maps[player_match_key]
            match_dates[(map_name, filename_match)].add(iso_date)
            duplicate_file_count += 1
            continue

        table = pq.read_table(path)
        missing = REQUIRED_COLUMNS.difference(table.column_names)
        if missing:
            raise ValueError(f"{path}: missing required columns: {', '.join(sorted(missing))}")
        rows = table.to_pylist()
        if not rows:
            continue
        timestamps = table.column("ts").cast("int64").to_pylist()
        unique_file_count += 1
        row_count += len(rows)
        for row, raw_timestamp in zip(rows, timestamps):
            if str(row["user_id"]) != source_id:
                raise ValueError(f"{path}: user_id column disagrees with filename")
            match_id = str(row["match_id"])
            if match_id != filename_match:
                raise ValueError(f"{path}: match_id column disagrees with filename")
            map_name = str(row["map_id"])
            if map_name not in MAPS:
                raise ValueError(f"{path}: unsupported map_id {map_name!r}")
            previous_map = match_maps.setdefault(match_id, map_name)
            if previous_map != map_name:
                raise ValueError(f"Inconsistent map for match {match_id}")
            if raw_timestamp is None:
                raise ValueError(f"{path}: null timestamp")
            # The Parquet type says timestamp[ms], but raw values are Unix seconds;
            # e.g. 1770754537 is 2026-02-10T20:15:37Z, matching source dates.
            timestamp_seconds = int(raw_timestamp)
            match_key = (map_name, match_id)
            match_dates[match_key].add(iso_date)
            match = matches.setdefault(match_key, {"times": []})
            player_id = pseudonym(source_id)
            bot = source_id.isdecimal()
            map_scale, origin_x, origin_z = MAPS[map_name]
            x, z = float(row["x"]), float(row["z"])
            u, v = (x - origin_x) / map_scale, 1.0 - (z - origin_z) / map_scale
            if not math.isfinite(u) or not math.isfinite(v):
                raise ValueError(f"{path}: non-finite coordinate")
            event = decode_event(row["event"])
            match["times"].append((timestamp_seconds, player_id, bot, u, v, event))
        player_match_files[player_match_key] = source_bytes
        player_match_maps[player_match_key] = match_maps[filename_match]

    grouped: dict[tuple[str, str], list[tuple[str, dict[str, Any]]]] = defaultdict(list)
    for (map_name, match_id), group in matches.items():
        events = group["times"]
        baseline = min(event[0] for event in events)
        last = max(event[0] for event in events)
        players: dict[str, dict[str, Any]] = {}
        for timestamp_seconds, player_id, bot, u, v, event in sorted(events, key=lambda item: item[0]):
            player = players.setdefault(player_id, {"id": player_id, "bot": bot, "events": []})
            player["events"].append([round(timestamp_seconds - baseline, 3), u, v, event])
        match_data = {
            "duration": round(last - baseline, 3),
            "players": sorted(players.values(), key=lambda player: player["id"]),
        }
        for iso_date in sorted(match_dates[(map_name, match_id)]):
            grouped[(map_name, iso_date)].append((match_id, match_data))


    minimap_output.mkdir(parents=True, exist_ok=True)
    minimap_files = {
        "AmbroseValley": "AmbroseValley_Minimap.png",
        "GrandRift": "GrandRift_Minimap.png",
        "Lockdown": "Lockdown_Minimap.jpg",
    }
    for map_name, filename in minimap_files.items():
        source = root / "minimaps" / filename
        with Image.open(source) as image:
            image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            image.convert("RGB").save(
                minimap_output / f"{map_name}.webp",
                format="WEBP",
                quality=86,
                method=6,
            )
    output.mkdir(parents=True, exist_ok=True)
    datasets = []
    for (map_name, iso_date), items in sorted(grouped.items()):
        items.sort(key=lambda item: item[0])
        relative = f"data/{map_name}-{iso_date}.json"
        payload = {
            "map": map_name,
            "date": iso_date,
            "matches": {match_id: data for match_id, data in items},
        }
        dest = output / f"{map_name}-{iso_date}.json"
        dest.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
        datasets.append({
            "map": map_name,
            "date": iso_date,
            "file": relative,
            "matches": [
                {"id": match_id, "duration": data["duration"], "players": len(data["players"])}
                for match_id, data in items
            ],
        })
    manifest = {"datasets": datasets}
    (output / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
    date_scoped_count = sum(len(d["matches"]) for d in datasets)
    print(
        f"Read {input_file_count} journey files; removed {duplicate_file_count} byte-identical duplicates "
        f"({unique_file_count} unique journeys, {row_count} samples). Wrote {len(datasets)} datasets "
        f"with {date_scoped_count} date-scoped entries for {len(matches)} unique matches to {output}"
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-root", type=Path, default=Path("."), help="Root containing February_10 through February_14 and minimaps/")
    parser.add_argument("--output-dir", type=Path, default=Path("data"), help="Site-root data directory (default: data)")
    parser.add_argument("--minimap-dir", type=Path, default=Path("assets/minimaps"), help="Directory for optimized WebP minimaps")
    args = parser.parse_args()
    try:
        convert(args.input_root, args.output_dir, args.minimap_dir)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
