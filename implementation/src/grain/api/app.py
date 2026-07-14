import secrets
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from grain.api import analysis, review, runs
from grain.config import Settings, load_settings
from grain.domain.brief import load_briefs
from grain.harness.jobs import Worker, sweep_orphaned_work
from grain.providers.registry import get_provider
from grain.store.db import connect, init_db
from grain.store.maintenance import backfill_call_payloads

WEB_DIR = Path(__file__).resolve().parents[1] / "web"

RATER_PREFIX = "/api/review/session/"  # the only API surface raters need


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    init_db(settings.data_dir)
    briefs = load_briefs(settings.briefs_dir)
    provider = get_provider(settings.provider)
    with closing(connect(settings.data_dir)) as conn:
        sweep_orphaned_work(conn)
        # Self-heal older demo data so the trace drill-down has prompts to show.
        backfill_call_payloads(conn, settings.data_dir, provider, briefs)

    app = FastAPI(title="grain", docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.briefs = briefs
    app.state.provider = provider
    app.state.worker = Worker(settings, provider, briefs)

    if settings.admin_token is not None:
        # Raters and researchers share the host; without this gate a rater could
        # unblind via the researcher API (concept/03, blinding). The cookie path
        # exists because <img> tags cannot send headers.
        @app.middleware("http")
        async def admin_gate(request: Request, call_next):
            path = request.url.path
            gated = path.startswith("/api") and not path.startswith(RATER_PREFIX)
            supplied = request.headers.get("x-admin-token") or request.cookies.get("grain_admin") or ""
            if gated and not secrets.compare_digest(supplied, settings.admin_token):
                return JSONResponse({"detail": "admin token required"}, status_code=401)
            return await call_next(request)

    @app.middleware("http")
    async def fresh_ui_assets(request: Request, call_next):
        # UI files are tiny and change during development; proxies in front of
        # the app (dev pane, playground ingress) must never serve stale modules.
        response = await call_next(request)
        if request.url.path.endswith((".js", ".css", ".html")) or request.url.path in ("/", "/review/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "provider": provider.name}

    @app.get("/review")
    def review_slash(request: Request):
        # The rater link is /review/?code=…; a missing trailing slash would 404
        # with raw JSON. Redirect so a hand-typed or trimmed link still lands.
        query = f"?{request.url.query}" if request.url.query else ""
        return RedirectResponse(f"/review/{query}", status_code=307)

    app.include_router(runs.router)
    app.include_router(review.router)
    app.include_router(analysis.router)

    app.mount("/review", StaticFiles(directory=WEB_DIR / "review", html=True), name="review")
    app.mount("/", StaticFiles(directory=WEB_DIR / "admin", html=True), name="admin")
    return app
