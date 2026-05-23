"""Aggregate token log data from hook output."""
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path


def _data_dir():
    d = Path.home() / ".rtk-dashboard"
    d.mkdir(exist_ok=True)
    return d


def read_log():
    log_file = _data_dir() / "token-log.jsonl"
    if not log_file.exists():
        return []
    entries = []
    for line in log_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def aggregate_by_day(entries):
    days = defaultdict(lambda: {
        "calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
        "models": defaultdict(int),
        "tools": defaultdict(int),
    })

    for e in entries:
        d = e.get("date", e.get("timestamp", "")[:10])
        if not d:
            continue
        day = days[d]
        day["date"] = d
        day["calls"] += 1
        day["input_tokens"] += e.get("input_tokens", 0)
        day["output_tokens"] += e.get("output_tokens", 0)
        day["cache_read_tokens"] += e.get("cache_read_tokens", 0)
        day["cache_write_tokens"] += e.get("cache_write_tokens", 0)
        day["models"][e.get("model_id", "unknown")] += 1
        day["tools"][e.get("tool_name", "unknown")] += 1

    result = []
    for d in sorted(days.keys()):
        day = dict(days[d])
        day["models"] = dict(day["models"])
        day["tools"] = dict(day["tools"])
        result.append(day)
    return result


def aggregate_by_week(entries):
    weeks = defaultdict(lambda: {
        "calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
    })

    for e in entries:
        try:
            d = datetime.strptime(e.get("date", "")[:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            continue
        # Week start (Monday)
        week_start = d - timedelta(days=d.weekday())
        key = week_start.strftime("%Y-%m-%d")

        w = weeks[key]
        w["week_start"] = key
        w["calls"] += 1
        w["input_tokens"] += e.get("input_tokens", 0)
        w["output_tokens"] += e.get("output_tokens", 0)
        w["cache_read_tokens"] += e.get("cache_read_tokens", 0)
        w["cache_write_tokens"] += e.get("cache_write_tokens", 0)

    return [dict(v) for _, v in sorted(weeks.items())]


def summary(entries):
    total_calls = 0
    total_input = 0
    total_output = 0
    total_cache_read = 0
    total_cache_write = 0
    models = defaultdict(int)
    sessions = set()

    for e in entries:
        total_calls += 1
        total_input += e.get("input_tokens", 0)
        total_output += e.get("output_tokens", 0)
        total_cache_read += e.get("cache_read_tokens", 0)
        total_cache_write += e.get("cache_write_tokens", 0)
        models[e.get("model_id", "unknown")] += 1
        sessions.add(e.get("session_id", ""))

    total_tokens = total_input + total_output
    cache_hit_rate = (total_cache_read / total_input * 100) if total_input > 0 else 0

    return {
        "total_calls": total_calls,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_tokens": total_tokens,
        "total_cache_read_tokens": total_cache_read,
        "total_cache_write_tokens": total_cache_write,
        "cache_hit_rate": round(cache_hit_rate, 1),
        "estimated_cache_savings": total_cache_read,
        "models": dict(models),
        "unique_sessions": len(sessions),
    }
