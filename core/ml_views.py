"""
ML forecast and reorder suggestion API views.

forecast.csv is pre-committed and served from disk. Reorder suggestions are
computed on request using live inventory from the database.
"""
import csv
import math
import statistics
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import error_response
from .models import Product


def _load_forecast() -> dict:
    """Load ml/forecast.csv and return a dict:
        {sku: [{"week_start": ..., "forecast_units": ...}, ...]}
    """
    csv_path = settings.ML_DIR / "forecast.csv"
    result = {}
    try:
        with open(csv_path, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                sku = row["sku"]
                if sku not in result:
                    result[sku] = []
                result[sku].append(
                    {
                        "week_start": row["week_start"],
                        "forecast_units": float(row["forecast_units"]),
                    }
                )
    except FileNotFoundError:
        pass
    # Sort weeks within each SKU
    for sku in result:
        result[sku].sort(key=lambda r: r["week_start"])
    return result


def _load_lead_times() -> dict:
    """Return {sku: lead_time_weeks} from data/lead_times.csv."""
    csv_path = settings.DATA_DIR / "lead_times.csv"
    result = {}
    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            result[row["sku"]] = int(row["lead_time_weeks"])
    return result


def _load_sales_history() -> dict:
    """Return {sku: [units_sold, ...]} ordered oldest-first."""
    csv_path = settings.DATA_DIR / "sales_history.csv"
    from collections import defaultdict

    raw = defaultdict(list)
    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            raw[row["sku"]].append((row["week_start"], int(row["units_sold"])))
    # Sort by week and return only units
    result = {}
    for sku, entries in raw.items():
        entries.sort(key=lambda x: x[0])
        result[sku] = [e[1] for e in entries]
    return result


class ForecastDetailView(APIView):
    """GET /api/forecast/{sku}/"""

    def get(self, request, sku):
        forecast = _load_forecast()
        if sku not in forecast:
            return error_response("NOT_FOUND", f"SKU '{sku}' not found in forecast set.", 404)
        return Response({"sku": sku, "forecast": forecast[sku]})


class ReorderSuggestionsView(APIView):
    """GET /api/reorder-suggestions/

    Formulas (exact, per the contract):
        L = lead_time_weeks
        lead_time_demand = sum(forecast_units for first L weeks)
        sigma = sample std dev (n-1) of units_sold for most recent 12 weeks
        safety_stock = ceil(1.65 * sigma * sqrt(L))
        reorder_point = lead_time_demand + safety_stock
        reorder_qty = max(0, ceil(reorder_point - current_stock))
    """

    def get(self, request):
        forecast = _load_forecast()
        lead_times = _load_lead_times()
        history = _load_sales_history()

        # Build live stock map
        skus = list(lead_times.keys())
        products = {p.sku: p.stock for p in Product.objects.filter(sku__in=skus)}

        results = []
        for sku in skus:
            L = lead_times[sku]
            weeks = forecast.get(sku, [])
            # lead_time_demand = sum of first L forecast weeks
            lead_time_demand = sum(w["forecast_units"] for w in weeks[:L])

            # sigma: sample std dev of most recent 12 historical weeks
            hist = history.get(sku, [])
            recent = hist[-12:] if len(hist) >= 1 else hist
            if len(recent) >= 2:
                sigma = statistics.stdev(recent)
            else:
                sigma = 0.0  # can't compute sample std dev with <2 obs

            safety_stock = math.ceil(1.65 * sigma * math.sqrt(L))
            reorder_point = lead_time_demand + safety_stock
            current_stock = products.get(sku, 0)
            reorder_qty = max(0, math.ceil(reorder_point - current_stock))

            results.append(
                {
                    "sku": sku,
                    "current_stock": current_stock,
                    "lead_time_weeks": L,
                    "lead_time_demand": round(lead_time_demand, 4),
                    "safety_stock": safety_stock,
                    "reorder_point": round(reorder_point, 4),
                    "reorder_qty": reorder_qty,
                }
            )

        return Response({"results": results})
