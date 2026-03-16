from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes_admin import router as admin_router
from app.api.v1.routes_auth import router as auth_router
from app.api.v1.routes_chat import router as chat_router
from app.api.v1.routes_conversations import router as conversations_router
from app.api.v1.routes_index import router as index_router
from app.api.v1.routes_projects import router as projects_router
from app.api.v1.routes_search import router as search_router
from app.api.v1.routes_tools import router as tools_router
from app.core.config import settings
from app.db.schema import ensure_app_schema


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    @app.on_event("startup")
    def on_startup() -> None:
        ensure_app_schema()

    app.include_router(auth_router, prefix="/v1")
    app.include_router(admin_router, prefix="/v1")
    app.include_router(chat_router, prefix="/v1")
    app.include_router(conversations_router, prefix="/v1")
    app.include_router(search_router, prefix="/v1")
    app.include_router(index_router, prefix="/v1")
    app.include_router(projects_router, prefix="/v1")
    app.include_router(tools_router, prefix="/v1")
    return app


app = create_app()
