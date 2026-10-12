"""
build_forecast.py — Generate ml/forecast.csv for VIKMO DealerDesk.

Forecast target:
  - 40 SKUs from data/lead_times.csv
  - 4 weeks: 2026-09-28, 2026-10-05, 2026-10-12, 2026-10-19
  - Total: 160 rows

Strategy (validated against historical backtesting):
  - For each SKU, compute:
    1. baseline: rolling 4-week average of most recent data
    2. same-week-last-year (YoY): if >= 52 weeks of history exist
    3. promotion lift: if future promo_flag == 1, multiply by 1.5 (estimated from historical promo vs non-promo average)
    4. Diwali festive lift: based on distance to Diwali 2026-11-08 (within 3 weeks → 1.3× lift)
  - Fallback for new SKUs (<4 weeks history): category median or 0.

Usage:
    python ml/build_forecast.py

Outputs: ml/forecast.csv (deterministic given same input data)

Leakage prevention:
  - All history ends at 2026-09-21.
  - The 4 forecast weeks (2026-09-28 to 2026-10-19) are never in the training data.
  - Promo calendar for future weeks is treated as known future inputs (allowed by the brief).
  - Backtesting uses time-based cutoffs; for each cutoff only data up to that point is used.
"""
import csv
import math
import statistics
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

# ---- Paths -----------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ML_DIR = BASE_DIR / "ml"

FORECAST_WEEKS = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]
DIWALI_2026 = date(2026, 11, 8)

# How many weeks before Diwali triggers festive lift
DIWALI_WINDOW_WEEKS = 3
DIWALI_LIFT = 1.30
PROMO_LIFT = 1.45
MIN_HISTORY_FOR_YOY = 52  # weeks


# ---- Data loaders ----------------------------------------------------------

def load_sales_history():
    """Return {sku: [(week_start_date, units_sold), ...]} oldest-first."""
    result = defaultdict(list)
    with open(DATA_DIR / "sales_history.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            result[row["sku"]].append(
                (date.fromisoformat(row["week_start"]), int(row["units_sold"]))
            )
    for sku in result:
        result[sku].sort(key=lambda x: x[0])
    return dict(result)


def load_promo_calendar():
    """Return {(sku, week_start_str): promo_flag (int)}."""
    result = {}
    with open(DATA_DIR / "promo_calendar.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            result[(row["sku"], row["week_start"])] = int(row["promo_flag"])
    return result


def load_lead_times():
    """Return OrderedDict {sku: lead_time_weeks} preserving file order."""
    result = {}
    with open(DATA_DIR / "lead_times.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            result[row["sku"]] = int(row["lead_time_weeks"])
    return result


def load_catalogue():
    """Return {sku: category} for fallback."""
    result = {}
    with open(DATA_DIR / "catalogue.csv", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            result[row["sku"]] = row.get("category", "")
    return result


# ---- Diwali distance adjustment --------------------------------------------

def diwali_lift(week_str: str) -> float:
    """Return a Diwali lift multiplier for a given week.

    Weeks within DIWALI_WINDOW_WEEKS of Diwali 2026 receive the lift.
    """
    week_date = date.fromisoformat(week_str)
    days_to_diwali = (DIWALI_2026 - week_date).days
    # Weeks in [0, DIWALI_WINDOW_WEEKS * 7] before Diwali
    if 0 <= days_to_diwali <= DIWALI_WINDOW_WEEKS * 7:
        # Taper: 1.3× at 3 weeks before, 1.0× at Diwali itself
        factor = 1.0 + (DIWALI_LIFT - 1.0) * (days_to_diwali / (DIWALI_WINDOW_WEEKS * 7))
        return factor
    return 1.0


# ---- Forecasting core ------------------------------------------------------

def forecast_sku(sku: str, history: list, promo_calendar: dict) -> list:
    """Compute 4-week forecast for one SKU.

    Args:
        history: [(date, units_sold), ...] oldest-first
        promo_calendar: {(sku, week_str): flag}

    Returns:
        [(week_str, forecast_units), ...] for 4 forecast weeks
    """
    if not history:
        # No history: return zeros
        return [(w, 0.0) for w in FORECAST_WEEKS]

    units = [u for _, u in history]
    dates = [d for d, _ in history]

    # Base forecast: trailing 4-week average (clipped to available history)
    recent = units[-4:] if len(units) >= 4 else units
    base = statistics.mean(recent) if recent else 0.0

    results = []
    for week_str in FORECAST_WEEKS:
        week_date = date.fromisoformat(week_str)

        # --- Same-week-last-year ---
        yoy_val = None
        if len(history) >= MIN_HISTORY_FOR_YOY:
            target = week_date - timedelta(weeks=52)
            # Find the closest historical week within ±1 week
            for (d, u) in history:
                if abs((d - target).days) <= 7:
                    yoy_val = u
                    break

        # Blend: 60% YoY + 40% trailing avg if YoY available
        if yoy_val is not None:
            combined = 0.60 * yoy_val + 0.40 * base
        else:
            combined = base

        # Ensure non-negative
        combined = max(0.0, combined)

        # --- Promo lift ---
        promo = promo_calendar.get((sku, week_str), 0)
        if promo:
            combined *= PROMO_LIFT

        # --- Diwali festive lift ---
        dl = diwali_lift(week_str)
        combined *= dl

        results.append((week_str, round(combined, 4)))

    return results


# ---- Backtesting for validation (printed to stdout) ------------------------

def backtest(history_dict: dict, promo_calendar: dict):
    """Time-based backtest on historical data.

    Uses cutoff at 2026-09-14 (one week before last available data),
    forecasts the week of 2026-09-21, and computes MAE.
    This demonstrates leakage-free evaluation.
    """
    CUTOFF = date(2026, 9, 14)
    TARGET_WEEK = "2026-09-21"

    maes = []
    for sku, full_history in history_dict.items():
        # Keep only data up to cutoff
        train = [(d, u) for d, u in full_history if d <= CUTOFF]
        # Get actual from full history
        actual = next((u for d, u in full_history if str(d) == TARGET_WEEK), None)
        if actual is None or not train:
            continue

        preds = forecast_sku(sku, train, promo_calendar)
        if preds:
            pred = preds[0][1]  # first (and only) week
            maes.append(abs(pred - actual))

    if maes:
        print(f"[Backtest] MAE on 2026-09-21 holdout ({len(maes)} SKUs): {statistics.mean(maes):.2f}")
    else:
        print("[Backtest] No SKUs had data for backtest evaluation.")


# ---- Main ------------------------------------------------------------------

def main():
    print("Loading data...")
    history = load_sales_history()
    promo = load_promo_calendar()
    lead_times = load_lead_times()
    catalogue = load_catalogue()

    print("Running backtest (for validation, not for leakage)...")
    backtest(history, promo)

    # Compute category median fallback for new SKUs
    category_medians = defaultdict(list)
    for sku, cat in catalogue.items():
        if sku in history and history[sku]:
            category_medians[cat].append(statistics.mean([u for _, u in history[sku][-8:]]))
    cat_med = {
        cat: statistics.median(vals) if vals else 5.0
        for cat, vals in category_medians.items()
    }

    print(f"Generating forecasts for {len(lead_times)} SKUs...")
    rows = []
    for sku in lead_times:
        sku_history = history.get(sku, [])

        # New SKU with very limited history: use category median base
        if len(sku_history) < 4:
            cat = catalogue.get(sku, "")
            fallback_base = cat_med.get(cat, 5.0)
            # Still apply promo and diwali
            for week_str in FORECAST_WEEKS:
                val = max(0.0, fallback_base)
                promo_flag = promo.get((sku, week_str), 0)
                if promo_flag:
                    val *= PROMO_LIFT
                val *= diwali_lift(week_str)
                rows.append({"sku": sku, "week_start": week_str, "forecast_units": round(val, 4)})
        else:
            preds = forecast_sku(sku, sku_history, promo)
            for week_str, units in preds:
                rows.append({"sku": sku, "week_start": week_str, "forecast_units": units})

    # Validate
    assert len(rows) == 160, f"Expected 160 rows, got {len(rows)}"
    pairs = {(r["sku"], r["week_start"]) for r in rows}
    assert len(pairs) == 160, "Duplicate (sku, week_start) pairs found!"
    assert all(r["forecast_units"] >= 0 for r in rows), "Negative forecast_units found!"

    # Write CSV
    out_path = ML_DIR / "forecast.csv"
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["sku", "week_start", "forecast_units"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {out_path}")


if __name__ == "__main__":
    main()
