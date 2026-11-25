"""Optional, idempotent demo data. Never runs automatically on app startup."""
from decimal import Decimal
from sqlalchemy import func, select
from app.database import SessionLocal
from app.models import Product

DEMO_PRODUCTS = [
    ("Studio wireless headphones", "Over-ear headphones with active noise cancellation and 40-hour battery life.", "3499.00", 24, "Electronics"),
    ("Mechanical keyboard", "Compact keyboard with tactile switches and a durable aluminum frame.", "4299.00", 12, "Electronics"),
    ("Adjustable desk lamp", "Dimmable LED lamp with a warm reading mode.", "1299.00", 5, "Workspace"),
    ("Everyday canvas tote", "Reusable heavyweight canvas bag with an interior pocket.", "599.00", 48, "Accessories"),
    ("Ceramic coffee mug", "350 ml stoneware mug with a satin glaze.", "449.00", 32, "Home & living"),
    ("A5 dotted notebook", "Lay-flat notebook with 160 pages of recycled paper.", "299.00", 3, "Stationery"),
    ("Aluminum laptop stand", "Ventilated, foldable stand for laptops up to 16 inches.", "1899.00", 16, "Workspace"),
    ("Insulated water bottle", "Double-wall stainless steel bottle, 750 ml.", "899.00", 0, "Accessories"),
    ("USB-C desktop hub", "Six-port hub with HDMI, USB-A and power delivery.", "2499.00", 9, "Electronics"),
    ("Felt desk mat", "Soft desk mat with an anti-slip backing, 80 x 40 cm.", "799.00", 21, "Workspace"),
    ("Weekly planner", "Undated planner with space for notes and priorities.", "349.00", 7, "Stationery"),
    ("Linen cushion cover", "Natural linen cushion cover, 45 x 45 cm.", "699.00", 18, "Home & living"),
]

def main():
    with SessionLocal() as session:
        if session.scalar(select(func.count()).select_from(Product)):
            print("Skipped: products already exist.")
            return
        for name, description, price, quantity, category in DEMO_PRODUCTS:
            session.add(Product(name=name, description=description, price=Decimal(price),
                                quantity=quantity, category=category))
        session.commit()
    print("Added 12 demo products.")


if __name__ == "__main__":
    main()
