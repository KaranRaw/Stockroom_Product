from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.schemas import ProductWrite


def payload(**changes):
    return {"name": "Desk lamp", "price": "149.90", "quantity": 4, **changes}


def test_trims_text_and_preserves_decimal():
    product = ProductWrite(**payload(name="  Desk lamp  ", category=" ", description="  Warm light  "))
    assert product.name == "Desk lamp"
    assert product.category is None
    assert product.description == "Warm light"
    assert product.price == Decimal("149.90")


@pytest.mark.parametrize("changes", [
    {"name": ""}, {"name": "   "}, {"name": "x" * 201}, {"price": "-0.01"},
    {"price": "1.001"}, {"price": "10000000000"}, {"price": "NaN"},
    {"price": "Infinity"}, {"price": True}, {"quantity": -1}, {"quantity": 1.5},
    {"quantity": True}, {"quantity": "2"}, {"quantity": 2147483648},
    {"category": "x" * 101}, {"description": "x" * 5001},
    {"created_at": "2026-01-01T00:00:00Z"},
])
def test_rejects_invalid_fields(changes):
    with pytest.raises(ValidationError):
        ProductWrite(**payload(**changes))


def test_zero_price_and_stock_are_valid():
    product = ProductWrite(**payload(price="0.00", quantity=0))
    assert product.price == 0
    assert product.quantity == 0
