"""SQLite store for conversations: the question as the model saw it, the answer, and the visitor's rating.

One short-lived connection per call, serialised by a lock: single-writer by design, like the other stores.
To scale out, put a database server behind the same methods.
"""

from __future__ import annotations

import sqlite3
import threading
from collections.abc import Iterator
from contextlib import closing, contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.conversations.models import FeedbackStats
from app.core.constants import Confidence, FeedbackFilter, Language, Rating, ResponseKind, Verdict

DB_NAME = "conversations.sqlite3"
BUSY_TIMEOUT_S = 5.0
LIKE_ESCAPE = "\\"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    request_id  TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    client      TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    language    TEXT NOT NULL,
    kind        TEXT NOT NULL,
    verdict     TEXT,
    confidence  TEXT,
    question    TEXT NOT NULL,
    response    TEXT NOT NULL,
    model       TEXT NOT NULL,
    latency_ms  INTEGER NOT NULL,
    rating      TEXT,
    rated_at    TEXT,
    comment     TEXT
);
CREATE INDEX IF NOT EXISTS conversations_created ON conversations (created_at DESC);
"""
_LIST_COLUMNS = (
    "request_id, created_at, client, contract_id, language, kind, verdict, confidence, question, "
    "NULL AS response, model, latency_ms, rating, rated_at, comment"
)


@dataclass(frozen=True)
class ConversationRow:
    """One stored exchange. ``response`` is the answer as JSON; it is left out of list queries."""

    request_id: str
    created_at: datetime
    client: str  # pseudonymous hash; proves who may rate the answer and is never shown
    contract_id: str
    language: Language
    kind: ResponseKind
    verdict: Verdict | None
    confidence: Confidence | None
    question: str
    response: str | None
    model: str
    latency_ms: int
    rating: Rating | None = None
    rated_at: datetime | None = None
    comment: str | None = None


def _stamp(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(
        timespec="microseconds"
    )  # one fixed shape, so text order is time order


def _like(text: str) -> str:
    escaped = (
        text.replace(LIKE_ESCAPE, LIKE_ESCAPE * 2)
        .replace("%", f"{LIKE_ESCAPE}%")
        .replace("_", f"{LIKE_ESCAPE}_")
    )
    return f"%{escaped}%"


def _row(record: sqlite3.Row) -> ConversationRow:
    verdict, confidence, rating, rated_at = (
        record[key] for key in ("verdict", "confidence", "rating", "rated_at")
    )
    return ConversationRow(
        request_id=record["request_id"],
        created_at=datetime.fromisoformat(record["created_at"]),
        client=record["client"],
        contract_id=record["contract_id"],
        language=Language(record["language"]),
        kind=ResponseKind(record["kind"]),
        verdict=Verdict(verdict) if verdict else None,
        confidence=Confidence(confidence) if confidence else None,
        question=record["question"],
        response=record["response"],
        model=record["model"],
        latency_ms=record["latency_ms"],
        rating=Rating(rating) if rating else None,
        rated_at=datetime.fromisoformat(rated_at) if rated_at else None,
        comment=record["comment"],
    )


class ConversationStore:
    def __init__(self, root: Path) -> None:
        root.mkdir(parents=True, exist_ok=True)
        self._path = root / DB_NAME
        self._lock = threading.Lock()
        with self._connect() as db:
            db.executescript(_SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        """A transaction on a fresh connection: committed on success, rolled back on error, always closed."""
        with self._lock, closing(sqlite3.connect(self._path, timeout=BUSY_TIMEOUT_S)) as db:
            db.row_factory = sqlite3.Row
            with db:
                yield db

    # --- writes -----------------------------------------------------------------------------

    def add(self, row: ConversationRow) -> bool:
        """Save an exchange. An id already in use keeps its first owner and this call changes nothing."""
        if row.response is None:
            raise ValueError("a stored conversation needs its response")
        with self._connect() as db:
            cursor = db.execute(
                "INSERT OR IGNORE INTO conversations (request_id, created_at, client, contract_id, language, "
                "kind, verdict, confidence, question, response, model, latency_ms) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    row.request_id,
                    _stamp(row.created_at),
                    row.client,
                    row.contract_id,
                    row.language.value,
                    row.kind.value,
                    row.verdict.value if row.verdict else None,
                    row.confidence.value if row.confidence else None,
                    row.question,
                    row.response,
                    row.model,
                    row.latency_ms,
                ),
            )
            return cursor.rowcount == 1

    def set_feedback(
        self, request_id: str, client: str, rating: Rating, comment: str | None, rated_at: datetime
    ) -> bool:
        """Rate an answer, replacing any earlier rating. False if there is no such answer for this client."""
        with self._connect() as db:
            cursor = db.execute(
                "UPDATE conversations SET rating = ?, rated_at = ?, comment = ? "
                "WHERE request_id = ? AND client = ?",
                (rating.value, _stamp(rated_at), comment, request_id, client),
            )
            return cursor.rowcount == 1

    def delete(self, request_id: str) -> bool:
        with self._connect() as db:
            return db.execute("DELETE FROM conversations WHERE request_id = ?", (request_id,)).rowcount == 1

    def prune(self, *, older_than: datetime, keep_latest: int) -> int:
        """Drop what is past retention, then what exceeds the cap (oldest first). Returns how many went."""
        with self._connect() as db:
            aged = db.execute(
                "DELETE FROM conversations WHERE created_at < ?", (_stamp(older_than),)
            ).rowcount
            surplus = db.execute(
                "DELETE FROM conversations WHERE request_id IN "
                "(SELECT request_id FROM conversations "
                "ORDER BY created_at DESC, request_id LIMIT -1 OFFSET ?)",
                (keep_latest,),
            ).rowcount
            return aged + surplus

    # --- reads --------------------------------------------------------------------------------

    def get(self, request_id: str) -> ConversationRow | None:
        with self._connect() as db:
            record = db.execute("SELECT * FROM conversations WHERE request_id = ?", (request_id,)).fetchone()
        return _row(record) if record else None

    def page(
        self, *, feedback: FeedbackFilter | None, text: str | None, limit: int, offset: int
    ) -> tuple[int, list[ConversationRow]]:
        """Newest first. Returns the number of matches and the requested slice of them."""
        conditions: list[str] = []
        params: list[str | int] = []
        if feedback is FeedbackFilter.UNRATED:
            conditions.append("rating IS NULL")
        elif feedback is not None:
            conditions.append("rating = ?")
            params.append(feedback.value)
        if text:
            conditions.append(
                f"(question LIKE ? ESCAPE '{LIKE_ESCAPE}' OR comment LIKE ? ESCAPE '{LIKE_ESCAPE}')"
            )
            params += [_like(text)] * 2
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        # `where` is assembled from the fixed fragments above; every value travels as a bound parameter.
        with self._connect() as db:
            total = db.execute(f"SELECT COUNT(*) FROM conversations {where}", params).fetchone()[0]  # noqa: S608
            records = db.execute(
                f"SELECT {_LIST_COLUMNS} FROM conversations {where} "  # noqa: S608
                "ORDER BY created_at DESC, request_id LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()
        return total, [_row(record) for record in records]

    def stats(self) -> FeedbackStats:
        with self._connect() as db:
            total, up, down, commented = db.execute(
                "SELECT COUNT(*), COALESCE(SUM(rating = ?), 0), COALESCE(SUM(rating = ?), 0), "
                "COALESCE(SUM(comment IS NOT NULL), 0) FROM conversations",
                (Rating.UP.value, Rating.DOWN.value),
            ).fetchone()
        rated = up + down
        return FeedbackStats(
            conversations=total,
            rated=rated,
            up=up,
            down=down,
            commented=commented,
            satisfaction=up / rated if rated else None,
        )
