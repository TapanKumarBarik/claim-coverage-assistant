"""Download the public policy documents listed in data/sources.yaml.

The documents are third-party material, so they are fetched rather than committed.
Servers that refuse automated downloads are respected: the script reports the file
to fetch by hand instead of trying to get around the block.

    python scripts/fetch_sources.py
"""

from __future__ import annotations

import sys
import urllib.error
import urllib.request
from pathlib import Path

import yaml

DATA = Path(__file__).resolve().parent.parent / "data"
USER_AGENT = "foyer-claims-assistant/0.1 (job-application demo; fetches public policy PDFs)"


def fetch(url: str, target: Path) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310 - https URLs from our manifest
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
            body = response.read()
    except urllib.error.HTTPError as exc:
        return f"refused ({exc.code}); download it manually in a browser and save as {target}"
    except urllib.error.URLError as exc:
        return f"failed ({exc.reason})"
    if not body.startswith(b"%PDF"):
        return "not a PDF; skipped"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    return f"ok ({len(body) // 1024} KB)"


def main() -> int:
    spec = yaml.safe_load((DATA / "sources.yaml").read_text(encoding="utf-8"))
    failures = 0
    for contract in spec["contracts"]:
        for doc in contract["documents"]:
            target = DATA / doc["file"]
            if target.exists():
                print(f"= {doc['id']}: already present")
                continue
            if not doc.get("source_url"):
                print(f"= {doc['id']}: bundled in the repo, nothing to fetch")
                continue
            result = fetch(doc["source_url"], target)
            failures += not result.startswith("ok")
            print(f"+ {doc['id']}: {result}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
