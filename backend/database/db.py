"""Database connection and helper functions using aiosqlite."""
import aiosqlite
import os

DATABASE_PATH = os.getenv("DATABASE_URL", "sqlite:///./diabetesconnect.db").replace("sqlite:///", "")
if not DATABASE_PATH:
    DATABASE_PATH = "diabetesconnect.db"


async def get_db():
    """Get an async database connection."""
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """Initialize the database with schema."""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        schema = f.read()
    db = await get_db()
    try:
        await db.executescript(schema)
        await db.commit()
    finally:
        await db.close()


async def fetch_one(query: str, params: tuple = None):
    """Execute a query and return one row as dict."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params or ())
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)
    finally:
        await db.close()


async def fetch_all(query: str, params: tuple = None):
    """Execute a query and return all rows as list of dicts."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params or ())
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await db.close()


async def execute(query: str, params: tuple = None):
    """Execute an insert/update/delete and return lastrowid."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params or ())
        await db.commit()
        return cursor.lastrowid
    finally:
        await db.close()

