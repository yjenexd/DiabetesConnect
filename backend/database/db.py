"""Database connection and helper functions using aiosqlite.

This module is the single DB gateway.

Performance: endpoints often do multiple queries; we reuse a single connection per request via
`request_db()` + a lightweight middleware that binds the connection to a contextvar.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any, Dict, List, Optional, Tuple

import aiosqlite


_request_db: ContextVar[Optional[aiosqlite.Connection]] = ContextVar("request_db", default=None)


def _resolve_database_path() -> str:
    """Resolve DATABASE_URL into a stable on-disk path.

    - Supports `sqlite:///./relative.db` (relative to `backend/`, not cwd).
    - Supports `sqlite:////absolute/path.db`.
    - Falls back to `./diabetesconnect.db`.
    """
    raw = (os.getenv("DATABASE_URL") or "sqlite:///./diabetesconnect.db").strip()

    path = raw
    if raw.startswith("sqlite:///"):
        path = raw[len("sqlite:///") :]

    if not path:
        path = "./diabetesconnect.db"

    # Treat relative paths as relative to backend/ so local dev works regardless of cwd.
    if not os.path.isabs(path):
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        path = os.path.join(backend_dir, path)

    return os.path.abspath(path)


async def _open_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(_resolve_database_path())
    db.row_factory = aiosqlite.Row
    return db


async def get_db() -> aiosqlite.Connection:
    """Get a DB connection.

    If a request-scoped connection exists, return it. Otherwise open a standalone connection.
    Callers that open a standalone connection are responsible for closing it.
    """
    bound = _request_db.get()
    if bound is not None:
        return bound
    return await _open_db()


@asynccontextmanager
async def request_db() -> aiosqlite.Connection:
    """Request-scoped DB connection context (1 connection per request)."""
    db = await _open_db()
    token = _request_db.set(db)
    try:
        yield db
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        _request_db.reset(token)
        await db.close()


async def init_db():
    """Initialize the database with schema."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        schema = f.read()
    db = await _open_db()
    try:
        await db.executescript(schema)
        await db.commit()
        # Migrations for existing databases
        for migration in [
            "ALTER TABLE meals ADD COLUMN sodium_mg REAL",
            "ALTER TABLE meals ADD COLUMN sugar_grams REAL",
        ]:
            try:
                await db.execute(migration)
                await db.commit()
            except Exception:
                pass  # Column already exists
    finally:
        await db.close()


async def _get_conn(db: Optional[aiosqlite.Connection]) -> Tuple[aiosqlite.Connection, bool]:
    if db is not None:
        return db, False
    bound = _request_db.get()
    if bound is not None:
        return bound, False
    return await _open_db(), True


async def fetch_one(query: str, params: tuple = (), db: Optional[aiosqlite.Connection] = None) -> Optional[Dict[str, Any]]:
    """Execute a query and return one row as dict (or None)."""
    conn, close_after = await _get_conn(db)
    try:
        cursor = await conn.execute(query, params)
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)
    finally:
        if close_after:
            await conn.close()


async def fetch_all(query: str, params: tuple = (), db: Optional[aiosqlite.Connection] = None) -> List[Dict[str, Any]]:
    """Execute a query and return all rows as list[dict]."""
    conn, close_after = await _get_conn(db)
    try:
        cursor = await conn.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        if close_after:
            await conn.close()


async def execute(query: str, params: tuple = (), db: Optional[aiosqlite.Connection] = None) -> int:
    """Execute an insert/update/delete and return cursor.lastrowid.

    Note: most tables use TEXT primary keys, so callers typically ignore this.
    """
    conn, close_after = await _get_conn(db)
    try:
        cursor = await conn.execute(query, params)
        await conn.commit()
        return cursor.lastrowid
    finally:
        if close_after:
            await conn.close()
