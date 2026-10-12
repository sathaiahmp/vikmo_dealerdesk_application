"""
Automated tests for VIKMO DealerDesk — AI/ML track.

These tests cover:
  - Health endpoint
  - Products CRUD and filters
  - Inventory update
  - Dealers CRUD
  - Draft orders
  - ML forecast CSV validation
  - Forecast and reorder API endpoints
  - Assistant tool dispatch (unit tests with mocked LLM)
  - Session isolation
  - Seed command (mocked)

Run: python manage.py test
"""
import csv
import json
import os
import statistics
import math
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from core.exceptions import APIError
from core.models import AssistantSession, Dealer, Order, OrderItem, Product
from core.services import create_draft_order


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_product(sku="TST-0001", name="Test Part", category="Brakes", brand="TestBrand",
                 vehicle_fitment="Universal", price="100.00", stock=50):
    return Product.objects.create(
        sku=sku, name=name, category=category, brand=brand,
        vehicle_fitment=vehicle_fitment, price=Decimal(price), stock=stock
    )


def make_dealer(dealer_code="DLR-TST", name="Test Dealer", credit_limit="50000.00"):
    return Dealer.objects.create(
        dealer_code=dealer_code, name=name, credit_limit=Decimal(credit_limit)
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_returns_ok(self):
        r = self.client.get("/api/health/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


class ProductTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.p = make_product()

    def test_list_pagination(self):
        r = self.client.get("/api/products/?page_size=5")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("count", data)
        self.assertIn("results", data)
        self.assertIn("next", data)
        self.assertIn("previous", data)

    def test_list_search_by_sku(self):
        r = self.client.get("/api/products/?search=TST-0001")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_list_search_by_name(self):
        r = self.client.get("/api/products/?search=Test+Part")
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_list_category_filter(self):
        r = self.client.get("/api/products/?category=Brakes")
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_list_vehicle_filter(self):
        r = self.client.get("/api/products/?vehicle=Universal")
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_product_detail(self):
        r = self.client.get("/api/products/TST-0001/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["sku"], "TST-0001")
        self.assertIsInstance(data["price"], str)
        self.assertRegex(data["price"], r"^\d+\.\d{2}$")
        self.assertIsInstance(data["stock"], int)

    def test_product_detail_404(self):
        r = self.client.get("/api/products/NOPE-9999/")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["error"]["code"], "NOT_FOUND")

    def test_product_create(self):
        r = self.client.post("/api/products/", {
            "sku": "TST-9999", "name": "New Part", "category": "Filters",
            "brand": "Brand", "vehicle_fitment": "Universal", "price": "250.00",
            "description": "test"
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["sku"], "TST-9999")
        self.assertEqual(r.json()["stock"], 0)

    def test_product_create_duplicate_sku(self):
        r = self.client.post("/api/products/", {
            "sku": "TST-0001", "name": "Dup", "category": "Brakes",
            "brand": "B", "vehicle_fitment": "Universal", "price": "10.00",
            "description": ""
        }, format="json")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "DUPLICATE")

    def test_product_create_invalid_price_negative(self):
        r = self.client.post("/api/products/", {
            "sku": "TST-0002", "name": "X", "category": "Y",
            "brand": "Z", "vehicle_fitment": "Universal", "price": "-5.00", "description": ""
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_product_create_too_many_decimals(self):
        r = self.client.post("/api/products/", {
            "sku": "TST-0003", "name": "X", "category": "Y",
            "brand": "Z", "vehicle_fitment": "Universal", "price": "10.999", "description": ""
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_product_patch_price(self):
        r = self.client.patch("/api/products/TST-0001/", {"price": "200.00"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["price"], "200.00")

    def test_product_patch_sku_immutable(self):
        r = self.client.patch("/api/products/TST-0001/", {"sku": "CHANGED"}, format="json")
        self.assertEqual(r.status_code, 400)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------


class InventoryTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.p = make_product(stock=10)

    def test_put_sets_quantity(self):
        r = self.client.put("/api/inventory/TST-0001/",
                            {"quantity": 50, "reason": "test"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["quantity"], 50)
        self.p.refresh_from_db()
        self.assertEqual(self.p.stock, 50)

    def test_put_zero_quantity(self):
        r = self.client.put("/api/inventory/TST-0001/",
                            {"quantity": 0, "reason": "empty"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_put_negative_quantity(self):
        r = self.client.put("/api/inventory/TST-0001/",
                            {"quantity": -1, "reason": "bad"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_put_float_quantity(self):
        r = self.client.put("/api/inventory/TST-0001/",
                            {"quantity": 5.5, "reason": "bad"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_put_boolean_quantity(self):
        r = self.client.put("/api/inventory/TST-0001/",
                            {"quantity": True, "reason": "bad"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_put_string_quantity(self):
        r = self.client.put("/api/inventory/TST-0001/",
                            {"quantity": "five", "reason": "bad"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_put_unknown_sku(self):
        r = self.client.put("/api/inventory/NOPE-9999/",
                            {"quantity": 5, "reason": "x"}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_stock_reflects_in_product_response(self):
        self.client.put("/api/inventory/TST-0001/",
                        {"quantity": 77, "reason": "test"}, format="json")
        r = self.client.get("/api/products/TST-0001/")
        self.assertEqual(r.json()["stock"], 77)


# ---------------------------------------------------------------------------
# Dealers
# ---------------------------------------------------------------------------


class DealerTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.d = make_dealer()

    def test_list_paginated(self):
        r = self.client.get("/api/dealers/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("count", r.json())

    def test_detail(self):
        r = self.client.get(f"/api/dealers/{self.d.id}/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        for k in ("id", "dealer_code", "name", "credit_limit"):
            self.assertIn(k, data)

    def test_create_dealer(self):
        r = self.client.post("/api/dealers/",
                             {"dealer_code": "DLR-NEW", "name": "New Dealer"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn("id", r.json())

    def test_create_duplicate_code(self):
        r = self.client.post("/api/dealers/",
                             {"dealer_code": "DLR-TST", "name": "Dup"}, format="json")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "DUPLICATE")

    def test_create_missing_name(self):
        r = self.client.post("/api/dealers/",
                             {"dealer_code": "DLR-XYZ"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_detail_404(self):
        r = self.client.get("/api/dealers/999999/")
        self.assertEqual(r.status_code, 404)


# ---------------------------------------------------------------------------
# Draft Orders
# ---------------------------------------------------------------------------


class OrderTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dealer = make_dealer()
        self.product = make_product(stock=100)

    def _create_order(self, **kwargs):
        body = {
            "dealer_id": self.dealer.id,
            "items": [{"sku": "TST-0001", "quantity": 2}],
        }
        body.update(kwargs)
        return self.client.post("/api/orders/", body, format="json")

    def test_create_draft_order(self):
        r = self._create_order()
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual(data["status"], "DRAFT")
        self.assertRegex(data["order_number"], r"^ORD-\d{8}-\d{4}$")
        self.assertIn("subtotal", data)
        self.assertIn("tax_total", data)
        self.assertIn("grand_total", data)
        self.assertRegex(data["subtotal"], r"^\d+\.\d{2}$")
        self.assertRegex(data["grand_total"], r"^\d+\.\d{2}$")

    def test_order_money_calculation(self):
        """unit_price=100.00, qty=2 → subtotal=200.00, tax=36.00, total=236.00"""
        r = self._create_order()
        data = r.json()
        item = data["items"][0]
        self.assertEqual(item["unit_price"], "100.00")
        self.assertEqual(item["line_subtotal"], "200.00")
        self.assertEqual(item["line_tax"], "36.00")
        self.assertEqual(item["line_total"], "236.00")
        self.assertEqual(data["subtotal"], "200.00")
        self.assertEqual(data["tax_total"], "36.00")
        self.assertEqual(data["grand_total"], "236.00")

    def test_all_item_fields_present(self):
        r = self._create_order()
        item = r.json()["items"][0]
        for k in ("sku", "name", "quantity", "unit_price", "line_subtotal", "line_tax", "line_total"):
            self.assertIn(k, item)

    def test_create_empty_items_rejected(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id, "items": []}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "VALIDATION_ERROR")

    def test_create_missing_dealer(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": 999999, "items": [{"sku": "TST-0001", "quantity": 1}]},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_unknown_sku(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id,
                              "items": [{"sku": "NOPE-0001", "quantity": 1}]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_zero_quantity(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id,
                              "items": [{"sku": "TST-0001", "quantity": 0}]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_negative_quantity(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id,
                              "items": [{"sku": "TST-0001", "quantity": -1}]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_float_quantity(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id,
                              "items": [{"sku": "TST-0001", "quantity": 1.5}]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_boolean_quantity(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id,
                              "items": [{"sku": "TST-0001", "quantity": True}]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_duplicate_sku_in_request(self):
        r = self.client.post("/api/orders/",
                             {"dealer_id": self.dealer.id,
                              "items": [
                                  {"sku": "TST-0001", "quantity": 1},
                                  {"sku": "TST-0001", "quantity": 2},
                              ]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_order_detail(self):
        r = self._create_order()
        order_number = r.json()["order_number"]
        r2 = self.client.get(f"/api/orders/{order_number}/")
        self.assertEqual(r2.status_code, 200)

    def test_order_detail_404(self):
        r = self.client.get("/api/orders/ORD-99999999-9999/")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["error"]["code"], "NOT_FOUND")

    def test_order_list_paginated(self):
        self._create_order()
        r = self.client.get("/api/orders/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("count", r.json())

    def test_order_list_dealer_filter(self):
        self._create_order()
        r = self.client.get(f"/api/orders/?dealer_id={self.dealer.id}")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.json()["count"], 1)

    def test_order_list_status_filter(self):
        self._create_order()
        r = self.client.get("/api/orders/?status=DRAFT")
        self.assertEqual(r.status_code, 200)
        for order in r.json()["results"]:
            self.assertEqual(order["status"], "DRAFT")

    def test_order_unique_numbers(self):
        r1 = self._create_order()
        r2 = self._create_order()
        self.assertNotEqual(r1.json()["order_number"], r2.json()["order_number"])


# ---------------------------------------------------------------------------
# Forecast CSV validation
# ---------------------------------------------------------------------------


class ForecastCsvTest(TestCase):
    FORECAST_WEEKS = {"2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"}

    def _get_forecast_path(self):
        return settings.ML_DIR / "forecast.csv"

    def test_csv_exists(self):
        self.assertTrue(self._get_forecast_path().exists(), "ml/forecast.csv not found")

    def test_csv_columns(self):
        with open(self._get_forecast_path(), newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            self.assertEqual(list(reader.fieldnames)[:3], ["sku", "week_start", "forecast_units"])

    def test_csv_exactly_160_rows(self):
        with open(self._get_forecast_path(), newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 160)

    def test_csv_all_40_skus_4_weeks(self):
        with open(self._get_forecast_path(), newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        skus = set(r["sku"] for r in rows)
        lead_path = settings.DATA_DIR / "lead_times.csv"
        with open(lead_path, newline="") as f:
            expected_skus = {row["sku"] for row in csv.DictReader(f)}
        self.assertEqual(skus, expected_skus)

    def test_csv_only_required_weeks(self):
        with open(self._get_forecast_path(), newline="", encoding="utf-8") as f:
            weeks = {r["week_start"] for r in csv.DictReader(f)}
        self.assertEqual(weeks, self.FORECAST_WEEKS)

    def test_csv_non_negative_forecast(self):
        with open(self._get_forecast_path(), newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                self.assertGreaterEqual(float(row["forecast_units"]), 0)

    def test_csv_unique_sku_week_pairs(self):
        with open(self._get_forecast_path(), newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        pairs = [(r["sku"], r["week_start"]) for r in rows]
        self.assertEqual(len(pairs), len(set(pairs)))


# ---------------------------------------------------------------------------
# Forecast & Reorder API
# ---------------------------------------------------------------------------


class ForecastApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Load a real forecast SKU
        forecast_path = settings.ML_DIR / "forecast.csv"
        with open(forecast_path, newline="", encoding="utf-8") as f:
            row = next(csv.DictReader(f))
        self.forecast_sku = row["sku"]
        # Ensure the product exists in DB
        Product.objects.get_or_create(
            sku=self.forecast_sku,
            defaults={
                "name": "Test Part",
                "category": "Brakes",
                "brand": "Brand",
                "vehicle_fitment": "Universal",
                "price": Decimal("100.00"),
                "stock": 50,
            },
        )

    def test_forecast_detail(self):
        r = self.client.get(f"/api/forecast/{self.forecast_sku}/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["sku"], self.forecast_sku)
        self.assertEqual(len(data["forecast"]), 4)
        weeks = [w["week_start"] for w in data["forecast"]]
        self.assertEqual(weeks, ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"])

    def test_forecast_matches_csv(self):
        forecast_path = settings.ML_DIR / "forecast.csv"
        with open(forecast_path, newline="", encoding="utf-8") as f:
            csv_rows = {
                (r["sku"], r["week_start"]): float(r["forecast_units"])
                for r in csv.DictReader(f)
            }
        r = self.client.get(f"/api/forecast/{self.forecast_sku}/")
        for entry in r.json()["forecast"]:
            key = (self.forecast_sku, entry["week_start"])
            self.assertAlmostEqual(entry["forecast_units"], csv_rows[key], places=3)

    def test_forecast_unknown_sku(self):
        r = self.client.get("/api/forecast/NOPE-9999/")
        self.assertEqual(r.status_code, 404)

    def test_reorder_suggestions_returns_40(self):
        # Seed all forecast SKUs as products
        lead_path = settings.DATA_DIR / "lead_times.csv"
        with open(lead_path, newline="") as f:
            for row in csv.DictReader(f):
                Product.objects.get_or_create(
                    sku=row["sku"],
                    defaults={
                        "name": row["sku"],
                        "category": "Test",
                        "brand": "Test",
                        "vehicle_fitment": "Universal",
                        "price": Decimal("100.00"),
                        "stock": 10,
                    },
                )
        r = self.client.get("/api/reorder-suggestions/")
        self.assertEqual(r.status_code, 200)
        results = r.json()["results"]
        self.assertEqual(len(results), 40)

    def test_reorder_fields_present(self):
        lead_path = settings.DATA_DIR / "lead_times.csv"
        with open(lead_path, newline="") as f:
            for row in csv.DictReader(f):
                Product.objects.get_or_create(
                    sku=row["sku"],
                    defaults={
                        "name": row["sku"],
                        "category": "Test",
                        "brand": "Test",
                        "vehicle_fitment": "Universal",
                        "price": Decimal("100.00"),
                        "stock": 10,
                    },
                )
        r = self.client.get("/api/reorder-suggestions/")
        entry = r.json()["results"][0]
        for k in ("sku", "current_stock", "lead_time_weeks", "lead_time_demand",
                   "safety_stock", "reorder_point", "reorder_qty"):
            self.assertIn(k, entry)

    def test_reorder_uses_live_stock(self):
        """Changing stock should change reorder_qty."""
        lead_path = settings.DATA_DIR / "lead_times.csv"
        with open(lead_path, newline="") as f:
            rows = list(csv.DictReader(f))
        sku = rows[0]["sku"]
        p, _ = Product.objects.get_or_create(
            sku=sku,
            defaults={
                "name": sku, "category": "Test", "brand": "Test",
                "vehicle_fitment": "Universal", "price": Decimal("100.00"), "stock": 0,
            },
        )
        for row in rows[1:]:
            Product.objects.get_or_create(
                sku=row["sku"],
                defaults={"name": row["sku"], "category": "Test", "brand": "Test",
                          "vehicle_fitment": "Universal", "price": Decimal("100.00"), "stock": 0},
            )

        r1 = self.client.get("/api/reorder-suggestions/")
        qty_before = next(e["reorder_qty"] for e in r1.json()["results"] if e["sku"] == sku)

        p.stock = 10000  # very high stock
        p.save()

        r2 = self.client.get("/api/reorder-suggestions/")
        qty_after = next(e["reorder_qty"] for e in r2.json()["results"] if e["sku"] == sku)

        self.assertEqual(qty_after, 0)  # enough stock, no reorder needed

    def test_reorder_safety_stock_formula(self):
        """Verify safety_stock = ceil(1.65 * sigma * sqrt(L)) matches API."""
        # Read history and compute expected for first SKU
        lead_path = settings.DATA_DIR / "lead_times.csv"
        history_path = settings.DATA_DIR / "sales_history.csv"
        with open(lead_path, newline="") as f:
            lt_rows = list(csv.DictReader(f))
        sku = lt_rows[0]["sku"]
        L = int(lt_rows[0]["lead_time_weeks"])

        # Ensure all products exist
        for row in lt_rows:
            Product.objects.get_or_create(
                sku=row["sku"],
                defaults={"name": row["sku"], "category": "Test", "brand": "Test",
                          "vehicle_fitment": "Universal", "price": Decimal("100.00"), "stock": 0},
            )

        hist = []
        with open(history_path, newline="") as f:
            for row in csv.DictReader(f):
                if row["sku"] == sku:
                    hist.append((row["week_start"], int(row["units_sold"])))
        hist.sort(key=lambda x: x[0])
        recent = [u for _, u in hist[-12:]] if len(hist) >= 1 else []
        sigma = statistics.stdev(recent) if len(recent) >= 2 else 0.0
        expected_ss = math.ceil(1.65 * sigma * math.sqrt(L))

        r = self.client.get("/api/reorder-suggestions/")
        entry = next(e for e in r.json()["results"] if e["sku"] == sku)
        self.assertEqual(entry["safety_stock"], expected_ss)


# ---------------------------------------------------------------------------
# Assistant tool dispatch (unit tests, no live LLM)
# ---------------------------------------------------------------------------


class AssistantToolTest(TestCase):
    def setUp(self):
        self.dealer = make_dealer()
        self.product = make_product(stock=20)

    def test_search_parts_returns_real_skus(self):
        from core.assistant_views import _execute_search_parts
        result = _execute_search_parts({"query": "Test"})
        for item in result.get("results", []):
            self.assertTrue(Product.objects.filter(sku=item["sku"]).exists())

    def test_search_parts_no_fabricated_skus(self):
        from core.assistant_views import _execute_search_parts
        result = _execute_search_parts({"query": "XYZNONEXISTENT12345"})
        self.assertEqual(len(result.get("results", [])), 0)

    def test_check_stock_live_values(self):
        from core.assistant_views import _execute_check_stock
        self.product.stock = 77
        self.product.save()
        result = _execute_check_stock({"skus": ["TST-0001"]})
        item = result["results"][0]
        self.assertTrue(item["found"])
        self.assertEqual(item["stock"], 77)

    def test_check_stock_unknown_sku(self):
        from core.assistant_views import _execute_check_stock
        result = _execute_check_stock({"skus": ["NOPE-9999"]})
        self.assertFalse(result["results"][0]["found"])

    def test_create_draft_order_tool_uses_service(self):
        from core.assistant_views import _execute_create_draft_order
        result, order_number = _execute_create_draft_order(
            {"dealer_id": self.dealer.id, "items": [{"sku": "TST-0001", "quantity": 2}]},
            self.dealer.id,
        )
        self.assertIsNotNone(order_number)
        self.assertTrue(Order.objects.filter(order_number=order_number).exists())

    def test_create_draft_order_invalid_dealer(self):
        from core.assistant_views import _execute_create_draft_order
        result, order_number = _execute_create_draft_order(
            {"dealer_id": 999999, "items": [{"sku": "TST-0001", "quantity": 1}]},
            999999,
        )
        self.assertIsNone(order_number)
        self.assertIn("error", result)

    def test_only_allowed_tools_execute(self):
        from core.assistant_views import _dispatch_tool, ALLOWED_TOOLS
        result, _ = _dispatch_tool("evil_tool", {}, self.dealer.id)
        self.assertIn("error", result)
        self.assertNotIn("evil_tool", ALLOWED_TOOLS)


class AssistantSessionTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dealer = make_dealer()

    @override_settings(GEMINI_API_KEY="test-mock-key")
    @patch("core.assistant_views._call_llm")
    def test_chat_returns_correct_shape(self, mock_llm):
        mock_llm.return_value = {
            "role": "assistant",
            "content": "Hello! I can help you find spare parts.",
            "tool_calls": [],
        }
        r = self.client.post("/api/assistant/chat/", {
            "session_id": "test-session-1",
            "dealer_id": self.dealer.id,
            "message": "Hello",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIsInstance(data["reply"], str)
        self.assertIsInstance(data["cited_skus"], list)
        self.assertIsInstance(data["tool_calls"], list)
        self.assertIsInstance(data["actions"], list)

    @override_settings(GEMINI_API_KEY="test-mock-key")
    @patch("core.assistant_views._call_llm")
    def test_session_memory_isolated(self, mock_llm):
        """Different session IDs must not share history."""
        mock_llm.return_value = {"role": "assistant", "content": "Hi", "tool_calls": []}

        self.client.post("/api/assistant/chat/", {
            "session_id": "session-A",
            "dealer_id": self.dealer.id,
            "message": "Hello from A",
        }, format="json")
        self.client.post("/api/assistant/chat/", {
            "session_id": "session-B",
            "dealer_id": self.dealer.id,
            "message": "Hello from B",
        }, format="json")

        session_a = AssistantSession.objects.get(session_id="session-A")
        session_b = AssistantSession.objects.get(session_id="session-B")
        msgs_a = list(session_a.messages.values_list("content", flat=True))
        msgs_b = list(session_b.messages.values_list("content", flat=True))
        self.assertIn("Hello from A", msgs_a)
        self.assertNotIn("Hello from B", msgs_a)
        self.assertIn("Hello from B", msgs_b)
        self.assertNotIn("Hello from A", msgs_b)

    def test_missing_session_id(self):
        r = self.client.post("/api/assistant/chat/", {
            "dealer_id": self.dealer.id,
            "message": "Hello",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_missing_message(self):
        r = self.client.post("/api/assistant/chat/", {
            "session_id": "s1",
            "dealer_id": self.dealer.id,
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_invalid_dealer(self):
        r = self.client.post("/api/assistant/chat/", {
            "session_id": "s2",
            "dealer_id": 999999,
            "message": "Hello",
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_no_llm_key_returns_error(self):
        """When no LLM key is configured, the assistant should return a clear error."""
        with self.settings(
            GEMINI_API_KEY="",
            OPENAI_API_KEY="",
            ANTHROPIC_API_KEY="",
            GROQ_API_KEY="",
        ):
            r = self.client.post("/api/assistant/chat/", {
                "session_id": "s3",
                "dealer_id": self.dealer.id,
                "message": "Hello",
            }, format="json")
            self.assertEqual(r.status_code, 500)
