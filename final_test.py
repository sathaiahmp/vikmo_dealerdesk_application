"""
Final Pre-Deployment Integration Test
Tests all 7 modules: Operations, Catalogue, Inventory, Dealers, Orders, AI, Forecast
"""
import urllib.request, json, sys

BASE = "http://127.0.0.1:8000"
PASS = []
FAIL = []

def check(name, path, method="GET", payload=None, expected_keys=None, expect_status=200):
    try:
        data = payload.encode() if payload else None
        req = urllib.request.Request(
            BASE + path,
            data=data,
            headers={"Content-Type": "application/json"} if data else {},
            method=method,
        )
        resp = urllib.request.urlopen(req, timeout=15)
        status = resp.status
        body = json.loads(resp.read())
        if expected_keys:
            for k in expected_keys:
                assert k in body, f"Missing key: {k}"
        PASS.append(f"PASS  {name}")
        return body
    except Exception as e:
        FAIL.append(f"FAIL  {name}: {e}")
        return None

# ── 1. HEALTH
check("Health check", "/api/health/", expected_keys=["status"])

# ── 2. PRODUCT CATALOGUE
r = check("Products list (paginated)", "/api/products/?page_size=10", expected_keys=["count","results","next"])
if r: assert r["count"] == 600, f"Expected 600, got {r['count']}"

r = check("Products search (brake)", "/api/products/?search=brake&page_size=5", expected_keys=["count","results"])
if r: assert r["count"] > 0

r = check("Products filter by category", "/api/products/?category=Brakes&page_size=5", expected_keys=["results"])
r = check("Products filter by vehicle", "/api/products/?vehicle=Pulsar&page_size=3", expected_keys=["results"])
r = check("Product detail", "/api/products/BRK-1019/", expected_keys=["sku","name","price","stock"])
if r: assert r["sku"] == "BRK-1019"

# ── 3. INVENTORY AUDIT
r = check("Inventory update (PUT)", "/api/inventory/BRK-1019/",
          method="PUT", payload=json.dumps({"quantity": 75, "reason": "Final deployment test adjustment"}),
          expected_keys=["sku","stock"])
if r: assert r["stock"] == 75, f"Expected 75, got {r.get('stock')}"

# ── 4. DEALER DIRECTORY
r = check("Dealers list", "/api/dealers/?page=1&page_size=10", expected_keys=["count","results"])
if r:
    assert r["count"] == 25, f"Expected 25 dealers, got {r['count']}"
    dealer_id = r["results"][0]["id"]

r = check("Dealer detail", f"/api/dealers/{dealer_id}/", expected_keys=["id","name","dealer_code","gstin"])

r = check("Create dealer", "/api/dealers/",
          method="POST",
          payload=json.dumps({"name": "Pre-Deploy Test Motors", "dealer_code": "PRETEST001",
                              "city": "Bengaluru", "gstin": "29PRETEST001Z5", "credit_limit": "50000.00"}),
          expected_keys=["id","name","dealer_code"])
if r: assert r["name"] == "Pre-Deploy Test Motors"

# ── 5. ORDERS & CHECKOUT
r = check("Orders list", "/api/orders/?page_size=5", expected_keys=["count","results"])

# Create draft order for dealer 1
r = check("Create draft order", "/api/orders/",
          method="POST",
          payload=json.dumps({"dealer_id": dealer_id, "items": [{"sku": "BRK-1019", "quantity": 5}]}),
          expected_keys=["order_number","status","grand_total","items"])
if r:
    assert r["status"] == "DRAFT"
    order_number = r["order_number"]
    r2 = check(f"Order detail ({order_number})", f"/api/orders/{order_number}/",
               expected_keys=["order_number","status","items"])

# ── 6. DEMAND FORECAST & ML
r = check("Reorder suggestions (40 SKUs)", "/api/reorder-suggestions/", expected_keys=["results"])
if r:
    assert len(r["results"]) == 40, f"Expected 40 SKUs, got {len(r['results'])}"
    first_sku = r["results"][0]["sku"]
    # Verify formula fields present
    item = r["results"][0]
    for field in ["sku","current_stock","lead_time_weeks","lead_time_demand","safety_stock","reorder_point","reorder_qty"]:
        assert field in item, f"Missing field: {field}"

r = check(f"4-week forecast ({first_sku})", f"/api/forecast/{first_sku}/", expected_keys=["sku","forecast"])
if r:
    assert len(r["forecast"]) == 4, f"Expected 4 forecast weeks, got {len(r['forecast'])}"
    for fw in r["forecast"]:
        assert "week_start" in fw and "forecast_units" in fw

# ── 7. Vite proxy (frontend→backend connection)
try:
    proxy_h = json.loads(urllib.request.urlopen("http://localhost:5173/api/health/", timeout=5).read())
    assert proxy_h.get("status") == "ok"
    PASS.append("PASS  Vite→Django proxy (localhost:5173 -> :8000)")
except Exception as e:
    FAIL.append(f"FAIL  Vite proxy: {e}")

# ── RESULTS
print("\n" + "="*60)
print("FINAL PRE-DEPLOYMENT TEST RESULTS")
print("="*60)
for p in PASS:
    print(p)
for f in FAIL:
    print(f)
print(f"\n{len(PASS)}/{len(PASS)+len(FAIL)} tests passed")
print("="*60)
if FAIL:
    sys.exit(1)
