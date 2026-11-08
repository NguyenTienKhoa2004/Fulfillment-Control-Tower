import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from app.config import get_settings
from app.routes import router

logger = logging.getLogger(__name__)
app = FastAPI(title="Netcom Logistics API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": f"HTTP_{exc.status_code}", "message": str(exc.detail)},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(
            {
                "code": "VALIDATION_ERROR",
                "message": "Invalid data.",
                "field_errors": [
                    {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
                    for error in exc.errors()
                ],
            }
        ),
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    logger.error("Database request failed: %s", type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={
            "code": "DATABASE_UNAVAILABLE",
            "message": "Unable to read or update data. Please try again later.",
        },
    )


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(router)
