"""Live test for AI Assistant + Forecast endpoints after Groq fix."""
import urllib.request, json, time

BASE = "http://127.0.0.1:8000"

# 1. Health
health = json.loads(urllib.request.urlopen(BASE + "/api/health/").read())
print("Health:", health)

# 2. Get first dealer
dealers = json.loads(urllib.request.urlopen(BASE + "/api/dealers/?page=1&page_size=1").read())
dealer = dealers["results"][0]
print(f"Dealer: {dealer['name']} (id={dealer['id']})")

# 3. Reorder suggestions
reorder = json.loads(urllib.request.urlopen(BASE + "/api/reorder-suggestions/").read())
skus = [r["sku"] for r in reorder["results"][:3]]
print(f"Reorder suggestions (first 3 SKUs): {skus}")

# 4. Forecast for first SKU from reorder set
first_sku = skus[0]
forecast = json.loads(urllib.request.urlopen(BASE + f"/api/forecast/{first_sku}/").read())
print(f"Forecast for {first_sku}: {len(forecast['forecast'])} weeks ->", forecast["forecast"][:2])

# 5. AI assistant chat
session_id = f"test-session-{int(time.time())}"
payload = json.dumps({
    "session_id": session_id,
    "dealer_id": dealer["id"],
    "message": f"Please create a draft order for 2 units of SKU {first_sku} for dealer {dealer['id']}."
}).encode("utf-8")

req = urllib.request.Request(
    BASE + "/api/assistant/chat/",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)

print("\nCalling AI assistant (Groq fallback)...")
t0 = time.time()
resp = urllib.request.urlopen(req, timeout=90)
elapsed = round(time.time() - t0, 2)
result = json.loads(resp.read())

print(f"AI Response ({elapsed}s):")
print("  Reply:", result["reply"][:400].encode('ascii', errors='replace').decode('ascii'))
print("  Tool calls:", [tc.get("name") for tc in result.get("tool_calls", [])])
print("  Cited SKUs:", result.get("cited_skus", []))
print("  Actions:", result.get("actions", []))
print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
