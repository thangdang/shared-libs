"""
Ollama Watchdog — Monitors Ollama health, restarts on failure.

Runs as background process on Windows.
Checks every 60 seconds, restarts after 3 consecutive failures.

Usage:
    python ollama-watchdog.py
    
Add to Task Scheduler or start via start-all-engines.bat
"""

import logging
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
import urllib.request
import urllib.error

# ─── Configuration ───
OLLAMA_URL = "http://localhost:11434/api/tags"
CHECK_INTERVAL = 60  # seconds
MAX_FAILURES = 3     # consecutive failures before restart
OLLAMA_EXE = r"C:\Users\evtxd01\AppData\Local\Programs\Ollama\ollama.exe"

# ─── Logging ───
LOG_DIR = Path(r"C:\Users\evtxd01\learn_python\logs")
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "ollama-watchdog.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("ollama-watchdog")


def check_ollama_health() -> bool:
    """Check if Ollama is responding."""
    try:
        req = urllib.request.Request(OLLAMA_URL, method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status == 200
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, TimeoutError):
        return False


def kill_ollama():
    """Kill all Ollama processes."""
    try:
        subprocess.run(
            ["taskkill", "/F", "/IM", "ollama.exe"],
            capture_output=True,
            timeout=10,
        )
        # Also kill ollama_llama_server if running
        subprocess.run(
            ["taskkill", "/F", "/IM", "ollama_llama_server.exe"],
            capture_output=True,
            timeout=10,
        )
        time.sleep(3)
        logger.info("Ollama processes killed")
    except Exception as e:
        logger.warning(f"Error killing Ollama: {e}")


def start_ollama():
    """Start Ollama serve in background."""
    try:
        subprocess.Popen(
            [OLLAMA_EXE, "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        logger.info("Ollama started, waiting 15s for initialization...")
        time.sleep(15)
    except Exception as e:
        logger.error(f"Failed to start Ollama: {e}")


def restart_ollama():
    """Kill and restart Ollama."""
    logger.warning("═══ RESTARTING OLLAMA ═══")
    kill_ollama()
    time.sleep(5)
    start_ollama()

    # Verify restart worked
    if check_ollama_health():
        logger.info("✓ Ollama restarted successfully")
        return True
    else:
        logger.error("✗ Ollama failed to restart")
        return False


def main():
    """Main watchdog loop."""
    logger.info("═══ Ollama Watchdog Started ═══")
    logger.info(f"Check interval: {CHECK_INTERVAL}s")
    logger.info(f"Failure threshold: {MAX_FAILURES}")
    logger.info(f"Ollama URL: {OLLAMA_URL}")
    logger.info(f"Ollama EXE: {OLLAMA_EXE}")

    consecutive_failures = 0
    total_restarts = 0

    while True:
        try:
            is_healthy = check_ollama_health()

            if is_healthy:
                if consecutive_failures > 0:
                    logger.info(f"✓ Ollama recovered (was failing for {consecutive_failures} checks)")
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                logger.warning(
                    f"✗ Ollama health check failed ({consecutive_failures}/{MAX_FAILURES})"
                )

                if consecutive_failures >= MAX_FAILURES:
                    total_restarts += 1
                    logger.error(
                        f"Threshold reached. Restarting Ollama (restart #{total_restarts})"
                    )
                    success = restart_ollama()
                    consecutive_failures = 0

                    if not success:
                        # Wait longer before next attempt
                        logger.error("Restart failed. Waiting 5 minutes before next check.")
                        time.sleep(300)

            time.sleep(CHECK_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Watchdog stopped by user")
            break
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
