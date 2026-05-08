"""Vercel serverless entry point.

Vercel routes `/api/*` requests here (via vercel.json rewrites). We import the
existing FastAPI app from main.py and add a middleware that strips the `/api`
path prefix so existing routes (`/crypto/markets`, `/analyze/{ticker}`, etc.)
keep working unchanged.
"""

from main import app


@app.middleware("http")
async def strip_api_prefix(request, call_next):
    """Remove the `/api` prefix added by Vercel's path routing."""
    path = request.scope.get("path", "")
    if path.startswith("/api/"):
        request.scope["path"] = path[4:]  # /api/foo -> /foo
        if "raw_path" in request.scope:
            request.scope["raw_path"] = request.scope["raw_path"][4:]
    elif path == "/api":
        request.scope["path"] = "/"
    return await call_next(request)
