"""JSONL event logger matching the legacy Hono backend format."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


LOG_FILE = Path(os.environ.get("LOG_FILE_PATH", "logs/patch.log")).resolve()


def log_event(event: str, data: dict[str, Any] | None = None) -> None:
    """Append a JSON event line to the log file.

    Mirrors the legacy logger.ts format:
    { "time": "...", "event": "...", ...data }\n\n
    """
    line = json.dumps(
        {
            "time": datetime.now(timezone.utc).isoformat(),
            "event": event,
            **(data or {}),
        },
        ensure_ascii=False,
    )
    print(line)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"{line}\n\n")
