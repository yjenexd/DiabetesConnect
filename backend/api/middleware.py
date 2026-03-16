"""Middleware — simplified for hackathon demo (no auth required)."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from database.db import request_db


class DBConnectionMiddleware(BaseHTTPMiddleware):
    """Bind a single SQLite connection to the request context.

    This prevents endpoints that do multiple queries from opening multiple connections.
    """

    async def dispatch(self, request: Request, call_next):
        async with request_db():
            return await call_next(request)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Error handling middleware."""

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "error": str(e)},
            )
