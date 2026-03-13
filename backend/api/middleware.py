"""Middleware — simplified for hackathon demo (no auth required)."""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


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

