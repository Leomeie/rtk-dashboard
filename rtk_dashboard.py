"""RTK Token Dashboard - Real-time token savings visualization."""
import json
import os
import subprocess
from pathlib import Path

from flask import Flask, jsonify, send_file

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
        result = subprocess.run(
            ["openwolf", *args],
            cwd=path, capture_output=True, text=True, timeout=30, encoding="utf-8"
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


if __name__ == "__main__":
    print("RTK Dashboard running at http://localhost:5678")
    app.run(host="127.0.0.1", port=5678, debug=False)
