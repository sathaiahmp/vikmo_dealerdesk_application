"""
seed_data management command.

Loads catalogue.csv (600 products) and dealers.csv (25 dealers).
Safe to run twice: uses update_or_create with stable unique keys.

Stock seeding strategy:
- On the FIRST run (empty DB), products get stock from catalogue.csv.
- On subsequent runs, if a product already exists, stock is NOT overwritten
  so that live inventory updates are not lost.
- To reset a product's stock, use PUT /api/inventory/{sku}/ instead.
"""
import csv
import sys
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.models import Dealer, Product


class Command(BaseCommand):
    help = "Load the files in data/ into the database. Must be safe to run more than once."

    def handle(self, *args, **options):
        data_dir = settings.DATA_DIR
        catalogue_path = data_dir / "catalogue.csv"
        dealers_path = data_dir / "dealers.csv"

        # Validate required files
        for path, label in [(catalogue_path, "catalogue.csv"), (dealers_path, "dealers.csv")]:
            if not path.exists():
                raise CommandError(f"Required file not found: {path}")

        products_created = 0
        products_updated = 0
        dealers_created = 0
        dealers_updated = 0

        from django.db import transaction

        # ---- Load Products -----------------------------------------------
        required_product_columns = {"sku", "name", "category", "brand", "vehicle_fitment", "price", "stock", "description"}

        with open(catalogue_path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise CommandError("catalogue.csv is empty or has no headers.")
            missing = required_product_columns - set(reader.fieldnames)
            if missing:
                raise CommandError(f"catalogue.csv is missing required columns: {missing}")

            existing_products = {p.sku: p for p in Product.objects.all()}
            to_create = []
            to_update = []

            for row_num, row in enumerate(reader, start=2):
                sku = row.get("sku", "").strip()
                if not sku:
                    self.stderr.write(f"  Row {row_num}: empty SKU, skipping.")
                    continue

                try:
                    price = Decimal(str(row["price"]).strip())
                except (InvalidOperation, ValueError):
                    self.stderr.write(f"  Row {row_num}: invalid price for {sku}, skipping.")
                    continue

                try:
                    csv_stock = int(float(row.get("stock", "0").strip() or "0"))
                except (ValueError, TypeError):
                    csv_stock = 0

                existing = existing_products.get(sku)
                if existing:
                    # Update non-stock fields only (preserve live stock)
                    existing.name = row["name"].strip()
                    existing.category = row["category"].strip()
                    existing.brand = row["brand"].strip()
                    existing.vehicle_fitment = row.get("vehicle_fitment", "Universal").strip()
                    existing.price = price
                    existing.description = row.get("description", "").strip()
                    to_update.append(existing)
                else:
                    new_product = Product(
                        sku=sku,
                        name=row["name"].strip(),
                        category=row["category"].strip(),
                        brand=row["brand"].strip(),
                        vehicle_fitment=row.get("vehicle_fitment", "Universal").strip(),
                        price=price,
                        stock=csv_stock,
                        description=row.get("description", "").strip(),
                    )
                    to_create.append(new_product)

            with transaction.atomic():
                if to_create:
                    Product.objects.bulk_create(to_create, batch_size=500)
                    products_created = len(to_create)
                if to_update:
                    Product.objects.bulk_update(
                        to_update,
                        ["name", "category", "brand", "vehicle_fitment", "price", "description"],
                        batch_size=500,
                    )
                    products_updated = len(to_update)

        self.stdout.write(
            self.style.SUCCESS(
                f"Products: {products_created} created, {products_updated} updated."
            )
        )

        # ---- Load Dealers -----------------------------------------------
        required_dealer_columns = {"dealer_code", "name"}

        with open(dealers_path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise CommandError("dealers.csv is empty or has no headers.")
            missing = required_dealer_columns - set(reader.fieldnames)
            if missing:
                raise CommandError(f"dealers.csv is missing required columns: {missing}")

            existing_dealers = {d.dealer_code: d for d in Dealer.objects.all()}
            dealers_to_create = []
            dealers_to_update = []

            for row_num, row in enumerate(reader, start=2):
                dealer_code = row.get("dealer_code", "").strip()
                name = row.get("name", "").strip()
                if not dealer_code or not name:
                    self.stderr.write(f"  Row {row_num}: missing dealer_code or name, skipping.")
                    continue

                try:
                    credit_limit = Decimal(str(row.get("credit_limit", "0") or "0").strip())
                except (InvalidOperation, ValueError):
                    credit_limit = Decimal("0.00")

                existing = existing_dealers.get(dealer_code)
                if existing:
                    existing.name = name
                    existing.city = row.get("city", "").strip()
                    existing.phone = row.get("phone", "").strip()
                    existing.email = row.get("email", "").strip()
                    existing.gstin = row.get("gstin", "").strip()
                    existing.credit_limit = credit_limit
                    dealers_to_update.append(existing)
                else:
                    new_dealer = Dealer(
                        dealer_code=dealer_code,
                        name=name,
                        city=row.get("city", "").strip(),
                        phone=row.get("phone", "").strip(),
                        email=row.get("email", "").strip(),
                        gstin=row.get("gstin", "").strip(),
                        credit_limit=credit_limit,
                    )
                    dealers_to_create.append(new_dealer)

            with transaction.atomic():
                if dealers_to_create:
                    Dealer.objects.bulk_create(dealers_to_create, batch_size=500)
                    dealers_created = len(dealers_to_create)
                if dealers_to_update:
                    Dealer.objects.bulk_update(
                        dealers_to_update,
                        ["name", "city", "phone", "email", "gstin", "credit_limit"],
                        batch_size=500,
                    )
                    dealers_updated = len(dealers_to_update)

        self.stdout.write(
            self.style.SUCCESS(
                f"Dealers: {dealers_created} created, {dealers_updated} updated."
            )
        )
        self.stdout.write(self.style.SUCCESS("seed_data complete."))

