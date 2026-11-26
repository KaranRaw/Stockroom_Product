from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.orm import Session
from app.database import get_session
from app.schemas import InventoryStats, ProductPage, ProductPatch, ProductRead, ProductWrite
from app import services

router = APIRouter(prefix="/api/products", tags=["Products"])
DB = Annotated[Session, Depends(get_session)]
ProductId = Annotated[int, Path(gt=0, le=2147483647)]


@router.get("", response_model=ProductPage)
def list_products(db: DB, search: str = Query("", max_length=200),
                  page: int = Query(1, ge=1, le=1000000),
                  page_size: int = Query(10, ge=1, le=100)):
    return services.list_products(db, search, page, page_size)


# Static routes must precede the dynamic product ID route.
@router.get("/stats", response_model=InventoryStats)
def stats(db: DB):
    return services.inventory_stats(db)


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: ProductId, db: DB):
    return services.require_product(db, product_id)


@router.post("", response_model=ProductRead, status_code=201)
def create_product(data: ProductWrite, response: Response, db: DB):
    product = services.save_product(db, data)
    response.headers["Location"] = f"/api/products/{product.id}"
    return product


@router.put("/{product_id}", response_model=ProductRead)
def update_product(product_id: ProductId, data: ProductWrite, db: DB):
    return services.save_product(db, data, services.require_product(db, product_id))


@router.patch("/{product_id}", response_model=ProductRead)
def patch_product(product_id: ProductId, data: ProductPatch, db: DB):
    return services.save_product(db, data, services.require_product(db, product_id))


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: ProductId, db: DB):
    services.soft_delete_product(db, product_id)
    return Response(status_code=204)
