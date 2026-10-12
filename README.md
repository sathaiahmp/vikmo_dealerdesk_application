# VIKMO DealerDesk — AI / ML Track

A Django REST API backend for VIKMO's spare-parts dealer management platform, implementing the **AI / ML intern track**: catalogue management, inventory, dealer orders, an LLM-powered dealer assistant with tool calling, and ML sales forecasting with reorder suggestions.

**Track: AI / ML**  
**No frontend is included.**

---

## Architecture

```
dealerdesk/          Django project settings, URLs, WSGI
core/
  models.py          Product, Dealer, Order, OrderItem, AssistantSession, AssistantMessage
  serializers.py     DRF serializers with money formatting
  views.py           Products, Inventory, Dealers, Orders API views
  assistant_views.py Dealer assistant with LLM tool-calling loop
  ml_views.py        Forecast and reorder suggestion endpoints
  services.py        Business logic: create_draft_order, GST, order numbers
  pagination.py      Standard 20/100 page size
  exceptions.py      Contract error envelope helper
  urls.py            All API URL routes
  tests.py           Full test suite (unit + integration)
  management/
    commands/
      seed_data.py   Idempotent catalogue + dealer loader
  migrations/        Committed Django migrations
ml/
  build_forecast.py  Forecast generation script
  forecast.csv       Committed 160-row forecast (40 SKUs × 4 weeks)
data/                Source CSV files (unchanged)
```

### Key design decisions
- **Single `core` app** — keeps the project simple and avoids over-engineering for a single-track assignment.
- **`stock` on Product directly** — no separate Inventory table; the contract describes a single quantity per product with no warehouse splits.
- **Service layer** (`services.py`) — both the REST API and the assistant's `create_draft_order` tool call the same function to avoid divergent logic.
- **Forecast served from CSV** — `ml/forecast.csv` is committed and served by the API, guaranteeing that the endpoint always returns deterministic values matching the committed file.

---

## Requirements

| Item | Version |
|---|---|
| Python | 3.11+ |
| Django | 4.2+ (tested on 5.2) |
| Django REST Framework | 3.15+ |
| Database | **PostgreSQL only** |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL URL, e.g. `postgres://user:pass@host:5432/dealerdesk` |
| `GEMINI_API_KEY` | ✅ (one LLM key) | Google Gemini API key (primary provider) |
| `OPENAI_API_KEY` | optional | OpenAI key (fallback) |
| `ANTHROPIC_API_KEY` | optional | Anthropic key (fallback) |
| `GROQ_API_KEY` | optional | Groq key (fallback) |
| `DJANGO_SECRET_KEY` | optional | Django secret key (defaults to insecure dev key) |
| `SUPPLIER_API_URL` | optional | Supplier mock URL (default: http://127.0.0.1:8099) |
| `SUPPLIER_API_KEY` | optional | Supplier API key |

**LLM Provider:** Google Gemini — **model: `gemini-1.5-flash`** — key variable: `GEMINI_API_KEY`.  
If `GEMINI_API_KEY` is absent, the assistant falls back to whichever of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GROQ_API_KEY` is set first.

---

## Setup & Run

### 1. Clone and install

```bash
git clone <your-repo-url>
cd dealerdesk
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and your LLM API key
```

### 3. Migrate and seed

```bash
python manage.py migrate --noinput
python manage.py seed_data
python manage.py seed_data   # safe to run twice
```

### 4. Generate forecast (already committed, but can be regenerated)

```bash
python ml/build_forecast.py
```

### 5. Start the server

```bash
python manage.py runserver 0.0.0.0:8000 --noreload
```

### Grader run contract

```bash
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py seed_data
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000 --noreload
```

---

## API Endpoints

### Health

```bash
curl http://localhost:8000/api/health/
# → {"status": "ok"}
```

### Products

```bash
# List (paginated, filters: search, category, vehicle)
curl "http://localhost:8000/api/products/?page_size=5"
curl "http://localhost:8000/api/products/?search=brake&vehicle=Pulsar"

# Detail
curl http://localhost:8000/api/products/BRK-1044/

# Create
curl -X POST http://localhost:8000/api/products/ \
  -H "Content-Type: application/json" \
  -d '{"sku":"TST-001","name":"Test","category":"Brakes","brand":"X","vehicle_fitment":"Universal","price":"100.00","description":""}'

# Partial update
curl -X PATCH http://localhost:8000/api/products/TST-001/ \
  -H "Content-Type: application/json" -d '{"price":"120.00"}'
```

### Inventory

```bash
curl -X PUT http://localhost:8000/api/inventory/BRK-1044/ \
  -H "Content-Type: application/json" \
  -d '{"quantity":50,"reason":"stock count correction"}'
```

### Dealers

```bash
curl http://localhost:8000/api/dealers/
curl http://localhost:8000/api/dealers/1/
curl -X POST http://localhost:8000/api/dealers/ \
  -H "Content-Type: application/json" \
  -d '{"dealer_code":"DLR-026","name":"New Dealer"}'
```

### Orders

```bash
# Create draft order
curl -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -d '{"dealer_id":1,"items":[{"sku":"BRK-1044","quantity":3}]}'

# List orders
curl "http://localhost:8000/api/orders/?dealer_id=1&status=DRAFT"

# Get order
curl http://localhost:8000/api/orders/ORD-20261012-0001/
```

### Dealer Assistant

```bash
curl -X POST http://localhost:8000/api/assistant/chat/ \
  -H "Content-Type: application/json" \
  -d '{"session_id":"sess-001","dealer_id":1,"message":"Do you have brake pads for Pulsar 150?"}'
```

### Forecasting & Reorder

```bash
curl http://localhost:8000/api/forecast/BRK-1090/
curl http://localhost:8000/api/reorder-suggestions/
```

---

## Tests

```bash
# Full test suite (requires DB connection)
python manage.py test

# Smoke test (requires running server + seeded DB)
python smoke_test.py --base-url http://localhost:8000 --track aiml
```

---

## Forecast Generation & Validation

```bash
# Regenerate forecast
python ml/build_forecast.py

# Validate CSV
python -c "
import csv
rows = list(csv.DictReader(open('ml/forecast.csv')))
print(f'Rows: {len(rows)}')
assert len(rows) == 160
pairs = {(r['sku'],r['week_start']) for r in rows}
assert len(pairs) == 160
assert all(float(r['forecast_units']) >= 0 for r in rows)
print('Forecast CSV valid')
"
```

**Forecast model:** Blended trailing 4-week average + same-week-last-year (60/40 blend when ≥ 52 weeks history), with Diwali festive lift (up to ×1.30 within 3 weeks of 2026-11-08) and promotion lift (×1.45 when `promo_flag=1`). New/rare SKUs use category-median baseline.  
**Backtest MAE** on 2026-09-21 holdout (40 SKUs): **12.48 units**.

---

## Retrieval Strategy

The assistant's `search_parts` tool uses **PostgreSQL ILIKE full-text search** over product name, category, and SKU fields. This avoids a paid vector database while remaining fully reproducible.  
If a vector embedding approach were needed, `pgvector` + sentence-transformers would be the natural addition — see `DECISIONS.md` Q2.

---

## LLM Provider & Model

| Item | Value |
|---|---|
| Primary provider | Google Gemini |
| Model | `gemini-1.5-flash` |
| Key variable | `GEMINI_API_KEY` |
| Fallback order | OpenAI → Anthropic → Groq |

---

## Optional Features

- **Supplier sync** (`POST /api/sync/supplier/`): **Not implemented** (optional for AI/ML track, time prioritised to assistant and forecasting).
- **Advanced order engine** (confirm/dispatch/deliver/cancel + GST lock + concurrency): **Not implemented** (optional for AI/ML track).

---

## Known Limitations

1. `search_parts` uses keyword ILIKE, not semantic embeddings — works well for direct product queries, less so for paraphrased queries.
2. Gemini's function-calling API response format changed between SDK versions; the integration targets `google-genai>=1.0` with the `protos` namespace.
3. Order number sequence uses `SELECT FOR UPDATE SKIP LOCKED` which works under the Django dev server but should be replaced with a DB sequence in production.
4. The forecast model is a statistical heuristic; a trained time-series model (Prophet, LightGBM) would score better given more engineering time.

---

## Video Walkthrough

*Link will be added after recording. (Placeholder — do not invent a URL.)*
