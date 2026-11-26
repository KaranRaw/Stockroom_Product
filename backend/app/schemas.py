from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated
from pydantic import (
    BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, TypeAdapter,
    field_serializer, field_validator, model_validator,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Price = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
Quantity = Annotated[int, Field(ge=0, le=2147483647, strict=True)]
IMAGE_URL_ADAPTER = TypeAdapter(HttpUrl)


class ProductFields(BaseModel):
    description: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, max_length=100)
    image_url: str | None = Field(default=None, max_length=2048)
    model_config = ConfigDict(extra="forbid")

    @field_validator("description", "category", "image_url", mode="before")
    @classmethod
    def trim_optional(cls, value):
        return (value.strip() or None) if isinstance(value, str) else value

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value):
        return " ".join(value.split()) or None if isinstance(value, str) else value

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value):
        if value is None:
            return None
        try:
            parsed = IMAGE_URL_ADAPTER.validate_python(value)
            port = parsed.port
            valid = (
                value.startswith("https://") and parsed.scheme == "https" and parsed.host
                and parsed.username is None and parsed.password is None
                and not any(character.isspace() for character in value)
                and (port is None or 0 < port <= 65535)
                and "\\" not in value
            )
        except ValueError:
            valid = False
        if not valid:
            raise ValueError("Use a valid public HTTPS image URL without embedded credentials")
        return value


class ProductWrite(ProductFields):
    name: Name
    price: Price
    quantity: Quantity

    @field_validator("price", mode="before")
    @classmethod
    def reject_boolean_price(cls, value):
        if isinstance(value, bool):
            raise ValueError("Price must be a decimal amount")
        return value


class ProductPatch(ProductFields):
    # Omission means unchanged; explicit null is allowed only for optional fields.
    name: Name | None = None
    price: Price | None = None
    quantity: Quantity | None = None

    @model_validator(mode="before")
    @classmethod
    def validate_patch(cls, data):
        if isinstance(data, dict):
            if not data:
                raise ValueError("Provide at least one field to update")
        return data

    @field_validator("name", "price", "quantity", mode="before")
    @classmethod
    def reject_null_required_fields(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value

    @field_validator("price", mode="before")
    @classmethod
    def reject_boolean_price(cls, value):
        if isinstance(value, bool):
            raise ValueError("Price must be a decimal amount")
        return value


class ProductRead(BaseModel):
    id: int
    name: str
    description: str | None
    price: Decimal
    quantity: int
    category: str | None
    image_url: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class ProductPage(BaseModel):
    items: list[ProductRead]
    total: int
    page: int
    page_size: int


class InventoryStats(BaseModel):
    products: int
    units: int
    value: Decimal
    low_stock: int


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail]


class ErrorResponse(BaseModel):
    error: ErrorBody


class CategoryWrite(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    model_config = ConfigDict(extra="forbid")

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        return " ".join(value.split()) if isinstance(value, str) else value


class CategoryRead(BaseModel):
    id: int
    name: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
