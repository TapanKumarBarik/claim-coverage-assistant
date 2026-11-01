"""File-backed storage for the catalog, document versions and the audit log.

Layout (under ``storage_dir``)::

    catalog.json
    audit.jsonl
    versions/<version-slug>/{source.<ext>, chunks.jsonl, embeddings.npy}

Single-instance by design: writes are serialised with an in-process lock and
the catalog is replaced atomically. That fits an App Service Free plan, which
runs one instance. Scaling out means moving the catalog to a database and the
files to blob storage; the ``Store`` interface is the seam for that.
"""

from __future__ import annotations

import json
import os
import re
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from app.catalog.domain import Catalog, Chunk


def _slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", value)


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


class Store:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.lock = threading.RLock()
        self._chunks: dict[str, list[Chunk]] = {}
        self._embeddings: dict[str, np.ndarray | None] = {}
        root.mkdir(parents=True, exist_ok=True)
        self._catalog = self._load_catalog()

    # --- catalog ---------------------------------------------------------

    @property
    def catalog_path(self) -> Path:
        return self.root / "catalog.json"

    def _load_catalog(self) -> Catalog:
        if not self.catalog_path.exists():
            return Catalog()
        return Catalog.model_validate_json(self.catalog_path.read_text(encoding="utf-8"))

    @property
    def catalog(self) -> Catalog:
        return self._catalog

    def save_catalog(self) -> None:
        with self.lock:
            payload = self._catalog.model_dump_json(indent=2)
            _atomic_write(self.catalog_path, payload.encode("utf-8"))

    @property
    def is_empty(self) -> bool:
        return not self._catalog.contracts

    # --- version payloads --------------------------------------------------

    def version_dir(self, version_id: str) -> Path:
        return self.root / "versions" / _slug(version_id)

    def write_version(
        self,
        version_id: str,
        *,
        source: bytes,
        source_name: str,
        chunks: list[Chunk],
        embeddings: np.ndarray | None,
    ) -> None:
        with self.lock:
            folder = self.version_dir(version_id)
            suffix = Path(source_name).suffix.lower() or ".bin"
            _atomic_write(folder / f"source{suffix}", source)
            lines = "\n".join(c.model_dump_json() for c in chunks)
            _atomic_write(folder / "chunks.jsonl", lines.encode("utf-8"))
            self._chunks[version_id] = chunks
            self.write_embeddings(version_id, embeddings)

    def write_embeddings(self, version_id: str, embeddings: np.ndarray | None) -> None:
        with self.lock:
            path = self.version_dir(version_id) / "embeddings.npy"
            if embeddings is None:
                path.unlink(missing_ok=True)
            else:
                tmp = path.with_suffix(".tmp.npy")
                np.save(tmp, embeddings.astype(np.float32))
                os.replace(tmp, path)
            self._embeddings[version_id] = embeddings

    def chunks(self, version_id: str) -> list[Chunk]:
        cached = self._chunks.get(version_id)
        if cached is not None:
            return cached
        path = self.version_dir(version_id) / "chunks.jsonl"
        if not path.exists():
            return []
        loaded = [
            Chunk.model_validate_json(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self._chunks[version_id] = loaded
        return loaded

    def embeddings(self, version_id: str) -> np.ndarray | None:
        if version_id in self._embeddings:
            return self._embeddings[version_id]
        path = self.version_dir(version_id) / "embeddings.npy"
        loaded = np.load(path) if path.exists() else None
        self._embeddings[version_id] = loaded
        return loaded

    def delete_version(self, version_id: str) -> None:
        with self.lock:
            folder = self.version_dir(version_id)
            if folder.exists():
                for child in folder.iterdir():
                    child.unlink()
                folder.rmdir()
            self._chunks.pop(version_id, None)
            self._embeddings.pop(version_id, None)

    # --- audit -------------------------------------------------------------

    def audit(self, actor: str, action: str, **details: Any) -> None:
        event = {
            "at": datetime.now(UTC).isoformat(timespec="seconds"),
            "actor": actor,
            "action": action,
            **details,
        }
        with self.lock:
            self.root.mkdir(parents=True, exist_ok=True)
            with (self.root / "audit.jsonl").open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, ensure_ascii=False) + "\n")

    def read_audit(self, limit: int = 100) -> list[dict[str, Any]]:
        path = self.root / "audit.jsonl"
        if not path.exists():
            return []
        lines = path.read_text(encoding="utf-8").splitlines()[-limit:]
        return [json.loads(line) for line in reversed(lines) if line.strip()]
