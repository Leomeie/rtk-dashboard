"""Import historical token data from Claude Code transcripts into token-log.jsonl."""
import json
import os
import sys
from pathlib import Path


def data_dir():
    d = Path.home() / ".rtk-dashboard"
    d.mkdir(exist_ok=True)
    return d


def find_transcript_dir():
    """Find Claude Code transcript directories."""
    claude_dir = Path.home() / ".claude" / "projects"
    if not claude_dir.exists():
        return []
    dirs = []
    for d in claude_dir.iterdir():
        if d.is_dir():
            dirs.append(d)
    return dirs


def extract_session_entries(transcript_file, session_id):
    """Extract token usage entries from a single transcript file."""
    entries = []
    try:
        with open(transcript_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Only process assistant messages with usage data
                if record.get("type") != "assistant":
                    continue
                message = record.get("message", {})
                usage = message.get("usage", {})
                if not usage:
                    continue

                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
                cache_read = usage.get("cache_read_input_tokens", 0)
                cache_write = usage.get("cache_creation_input_tokens", 0)

                # Skip empty entries
                if input_tokens == 0 and output_tokens == 0:
                    continue

                timestamp = record.get("timestamp", "")
                date = timestamp[:10] if timestamp else ""

                entries.append({
                    "timestamp": timestamp,
                    "date": date,
                    "session_id": session_id,
                    "cwd": "",
                    "tool_name": "api_call",
                    "model_id": message.get("model", "unknown"),
                    "model_name": message.get("model", "unknown"),
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cache_read_tokens": cache_read,
                    "cache_write_tokens": cache_write,
                    "context_window_size": 0,
                    "rate_limit_5h": 0,
                    "rate_limit_7d": 0,
                })
    except Exception as e:
        print(f"  Error reading {transcript_file}: {e}")
    return entries


def main():
    log_file = data_dir() / "token-log.jsonl"

    # Read existing entries to avoid duplicates
    existing = set()
    if log_file.exists():
        for line in log_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
                # Use (timestamp, session_id) as dedup key
                existing.add((e.get("timestamp", ""), e.get("session_id", "")))
            except json.JSONDecodeError:
                continue

    print(f"Existing entries: {len(existing)}")

    # Scan transcript directories
    transcript_dirs = find_transcript_dir()
    if not transcript_dirs:
        print("No Claude Code transcript directories found.")
        return

    all_entries = []
    files_scanned = 0

    for proj_dir in transcript_dirs:
        for f in proj_dir.iterdir():
            if f.suffix == ".jsonl" and f.is_file():
                session_id = f.stem
                entries = extract_session_entries(f, session_id)
                all_entries.extend(entries)
                files_scanned += 1

    print(f"Scanned {files_scanned} transcript files, found {len(all_entries)} token entries")

    # Deduplicate
    new_entries = [e for e in all_entries if (e["timestamp"], e["session_id"]) not in existing]
    print(f"New entries to import: {len(new_entries)}")

    if not new_entries:
        print("Nothing to import.")
        return

    # Append to log file
    with open(log_file, "a", encoding="utf-8") as f:
        for e in new_entries:
            f.write(json.dumps(e) + "\n")

    print(f"Imported {len(new_entries)} entries to {log_file}")

    # Show summary
    total_input = sum(e["input_tokens"] for e in new_entries)
    total_output = sum(e["output_tokens"] for e in new_entries)
    total_cache = sum(e["cache_read_tokens"] for e in new_entries)
    sessions = set(e["session_id"] for e in new_entries)
    print(f"  Total input tokens:  {total_input:,}")
    print(f"  Total output tokens: {total_output:,}")
    print(f"  Cache read tokens:   {total_cache:,}")
    print(f"  Sessions:            {len(sessions)}")


if __name__ == "__main__":
    main()
