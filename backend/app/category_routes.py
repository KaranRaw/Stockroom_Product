from typing import Annotated
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.categories import get_or_create_category, list_categories
from app.database import get_session
from app.schemas import CategoryRead, CategoryWrite

router = APIRouter(prefix="/api/categories", tags=["Categories"])
DB = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[CategoryRead])
def get_categories(db: DB):
    return list_categories(db)


@router.post("", response_model=CategoryRead, status_code=201,
             responses={200: {"model": CategoryRead, "description": "Existing category reused"}})
def create_category(data: CategoryWrite, response: Response, db: DB):
    category, created = get_or_create_category(db, data.name)
    db.commit()
    db.refresh(category)
    response.status_code = 201 if created else 200
    return category
