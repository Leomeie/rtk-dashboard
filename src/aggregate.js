const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function dataDir() {
  return path.join(os.homedir(), ".rtk-dashboard");
}

function readLog() {
  const logFile = path.join(dataDir(), "token-log.jsonl");
  if (!fs.existsSync(logFile)) return [];
  const lines = fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean);
  return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function aggregateByDay(entries) {
  const days = {};
  for (const e of entries) {
    const d = e.date || e.timestamp?.slice(0, 10);
    if (!d) continue;
    if (!days[d]) {
      days[d] = {
        date: d,
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        models: {},
        tools: {},
      };
    }
    const day = days[d];
    day.calls++;
    day.input_tokens += e.input_tokens || 0;
    day.output_tokens += e.output_tokens || 0;
    day.cache_read_tokens += e.cache_read_tokens || 0;
    day.cache_write_tokens += e.cache_write_tokens || 0;

    const model = e.model_id || "unknown";
    day.models[model] = (day.models[model] || 0) + 1;

    const tool = e.tool_name || "unknown";
    day.tools[tool] = (day.tools[tool] || 0) + 1;
  }
  return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByWeek(entries) {
  const weeks = {};
  for (const e of entries) {
    const d = new Date(e.date || e.timestamp?.slice(0, 10));
    if (isNaN(d)) continue;
    // Get week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    const weekKey = weekStart.toISOString().slice(0, 10);

    if (!weeks[weekKey]) {
      weeks[weekKey] = {
        week_start: weekKey,
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      };
    }
    const w = weeks[weekKey];
    w.calls++;
    w.input_tokens += e.input_tokens || 0;
    w.output_tokens += e.output_tokens || 0;
    w.cache_read_tokens += e.cache_read_tokens || 0;
    w.cache_write_tokens += e.cache_write_tokens || 0;
  }
  return Object.values(weeks).sort((a, b) => a.week_start.localeCompare(b.week_start));
}

function summary(entries) {
  let totalCalls = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  const models = {};

  for (const e of entries) {
    totalCalls++;
    totalInput += e.input_tokens || 0;
    totalOutput += e.output_tokens || 0;
    totalCacheRead += e.cache_read_tokens || 0;
    totalCacheWrite += e.cache_write_tokens || 0;
    const m = e.model_id || "unknown";
    models[m] = (models[m] || 0) + 1;
  }

  const totalTokens = totalInput + totalOutput;
  const cacheHitRate = totalInput > 0 ? (totalCacheRead / totalInput * 100) : 0;
  // Savings estimate: tokens saved by cache (cache_read tokens would have been re-sent)
  const estimatedCacheSavings = totalCacheRead;

  return {
    total_calls: totalCalls,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_tokens: totalTokens,
    total_cache_read_tokens: totalCacheRead,
    total_cache_write_tokens: totalCacheWrite,
    cache_hit_rate: Math.round(cacheHitRate * 10) / 10,
    estimated_cache_savings: estimatedCacheSavings,
    models,
    unique_sessions: new Set(entries.map((e) => e.session_id)).size,
  };
}

module.exports = { readLog, aggregateByDay, aggregateByWeek, summary };
