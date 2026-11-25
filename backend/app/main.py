import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException
from app.config import get_settings
from app.database import SessionLocal
from app.routes import router
from app.schemas import ErrorResponse

logger = logging.getLogger(__name__)
app = FastAPI(title="Stockroom Product API", version="1.1.0",
              description="Single-user product inventory. All prices are INR.",
              responses={code: {"model": ErrorResponse} for code in (404, 422, 500, 503)})
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type"])
app.include_router(router)


def error(status: int, code: str, message: str, details=None):
    return JSONResponse(status_code=status, content={
        "error": {"code": code, "message": message, "details": details or []}
    })


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(v) for v in item["loc"][1:]),
                "message": item["msg"]} for item in exc.errors()]
    return error(422, "VALIDATION_ERROR", "Please check the submitted fields.", details)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    codes = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}
    return error(exc.status_code, codes.get(exc.status_code, "REQUEST_ERROR"), str(exc.detail))


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    logger.error("Database operation failed", exc_info=exc)
    return error(503, "DATABASE_UNAVAILABLE", "Unable to complete the database operation.")


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logger.error("Unexpected request failure", exc_info=exc)
    return error(500, "INTERNAL_ERROR", "An unexpected error occurred.")


@app.get("/api/health", tags=["Health"])
def health():
    with SessionLocal() as session:
        session.execute(text("SELECT 1"))
    return {"status": "ok"}
