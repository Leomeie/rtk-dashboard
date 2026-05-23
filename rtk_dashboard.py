"""RTK Token Dashboard - Real-time token savings visualization."""
import json
import os
import subprocess
import sys
from pathlib import Path

from flask import Flask, jsonify, send_file

# Add src/ to path for aggregate module
sys.path.insert(0, str(Path(__file__).parent / "src"))
from aggregate import read_log, aggregate_by_day, aggregate_by_week, summary

app = Flask(__name__)

PROJECTS_FILE = Path(__file__).parent / "rtk_projects.json"


def load_projects():
    if PROJECTS_FILE.exists():
        return json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    return []


def save_projects(projects):
    PROJECTS_FILE.write_text(json.dumps(projects, indent=2, ensure_ascii=False), encoding="utf-8")


def run_rtk(*args):
    try:
        result = subprocess.run(
            ["rtk", *args],
            capture_output=True, text=True, timeout=10, encoding="utf-8"
        )
        return json.loads(result.stdout) if result.returncode == 0 else None
    except Exception:
        return None


@app.route("/")
def index():
    return send_file("dashboard.html")


@app.route("/projects")
def projects_page():
    return send_file("projects.html")


@app.route("/api/global")
def api_global():
    data = run_rtk("gain", "-a", "-f", "json")
    return jsonify(data or {"error": "Failed to fetch RTK data"})


@app.route("/api/global/quota")
def api_global_quota():
    data = run_rtk("gain", "-q", "-f", "json", "-t", "20x")
    return jsonify(data or {"error": "Failed to fetch quota data"})


@app.route("/api/projects", methods=["GET"])
def api_projects_list():
    return jsonify(load_projects())


@app.route("/api/projects", methods=["POST"])
def api_projects_add():
    from flask import request
    body = request.get_json(force=True)
    path = body.get("path", "").strip()
    name = body.get("name", "").strip()
    if not path or not Path(path).is_dir():
        return jsonify({"error": f"Directory not found: {path}"}), 400
    projects = load_projects()
    if any(p["path"] == path for p in projects):
        return jsonify({"error": "Project already exists"}), 409
    projects.append({"name": name or Path(path).name, "path": path})
    save_projects(projects)
    return jsonify({"ok": True, "projects": projects})


@app.route("/api/projects", methods=["DELETE"])
def api_projects_remove():
    from flask import request
    body = request.get_json(force=True)
    path = body.get("path", "").strip()
    projects = load_projects()
    projects = [p for p in projects if p["path"] != path]
    save_projects(projects)
    return jsonify({"ok": True, "projects": projects})


@app.route("/api/project")
def api_project():
    from flask import request
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "path required"}), 400
    original = os.getcwd()
    try:
        os.chdir(path)
        data = run_rtk("gain", "-p", "-a", "-f", "json")
    finally:
        os.chdir(original)
    return jsonify(data or {"error": "Failed to fetch project data"})


# --- OpenWolf ---

def run_openwolf(path, *args):
    try:
        env = os.environ.copy()
        node_global = str(Path(os.environ.get("APPDATA", "")) / "npm") if os.name == "nt" else ""
        # Common locations for openwolf binary
        for candidate in [
            r"D:\nodejs\node_global",
            r"C:\Users\Luo\AppData\Roaming\npm",
            os.path.join(os.environ.get("USERPROFILE", ""), "node_global"),
        ]:
            if os.path.isdir(candidate):
                env["PATH"] = candidate + os.pathsep + env.get("PATH", "")
                break
        result = subprocess.run(
            "openwolf " + " ".join(str(a) for a in args),
            cwd=path, capture_output=True, text=True, timeout=30, encoding="utf-8",
            env=env, shell=True
        )
        return {"stdout": result.stdout, "stderr": result.stderr, "code": result.returncode}
    except FileNotFoundError:
        return {"error": "openwolf not found"}
    except Exception as e:
        return {"error": str(e)}


@app.route("/api/openwolf/init", methods=["POST"])
def api_openwolf_init():
    from flask import request
    body = request.get_json(force=True)
    path = body.get("path", "").strip()
    if not path or not Path(path).is_dir():
        return jsonify({"error": f"Directory not found: {path}"}), 400
    result = run_openwolf(path, "init")
    return jsonify(result)


@app.route("/api/openwolf/status")
def api_openwolf_status():
    from flask import request
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "path required"}), 400
    wolf_dir = Path(path) / ".wolf"
    if not wolf_dir.is_dir():
        return jsonify({"initialized": False})
    ledger_file = wolf_dir / "token-ledger.json"
    ledger = {}
    if ledger_file.exists():
        try:
            ledger = json.loads(ledger_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    config_file = wolf_dir / "config.json"
    config = {}
    if config_file.exists():
        try:
            config = json.loads(config_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return jsonify({
        "initialized": True,
        "ledger": ledger.get("lifetime", {}),
        "sessions": ledger.get("sessions", []),
        "config": config.get("openwolf", {})
    })


# --- Token Tracking (from hook data) ---

@app.route("/api/tokens")
def api_tokens():
    """All token data: summary + daily + weekly."""
    entries = read_log()
    return jsonify({
        "summary": summary(entries),
        "daily": aggregate_by_day(entries),
        "weekly": aggregate_by_week(entries),
    })


@app.route("/api/tokens/summary")
def api_tokens_summary():
    """Summary stats only."""
    return jsonify(summary(read_log()))


@app.route("/api/tokens/daily")
def api_tokens_daily():
    """Daily breakdown."""
    return jsonify(aggregate_by_day(read_log()))


@app.route("/api/tokens/session")
def api_tokens_session():
    """Current/recent session data."""
    from flask import request
    session_id = request.args.get("session_id", "")
    entries = read_log()
    if session_id:
        entries = [e for e in entries if e.get("session_id") == session_id]
    else:
        # Return latest session
        if entries:
            latest_session = entries[-1].get("session_id", "")
            entries = [e for e in entries if e.get("session_id") == latest_session]
    return jsonify(summary(entries))


@app.route("/api/tokens/log")
def api_tokens_log():
    """Raw log entries (last N)."""
    from flask import request
    limit = int(request.args.get("limit", "100"))
    entries = read_log()
    return jsonify(entries[-limit:])


if __name__ == "__main__":
    port = 5678
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            port = int(sys.argv[idx + 1])
    print(f"RTK Dashboard running at http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
