from fastapi import APIRouter
from app.api.endpoints import users, surveys, auth, responses, admin, ai_insights, ai_chat, integration

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(surveys.router, prefix="/surveys", tags=["surveys"])
api_router.include_router(responses.router, prefix="/responses", tags=["responses"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(ai_insights.router, tags=["ai-insights"])
api_router.include_router(ai_chat.router, tags=["ai-chat"])
api_router.include_router(integration.router, prefix="/integration", tags=["integration"])
