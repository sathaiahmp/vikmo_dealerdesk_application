# VIKMO DealerDesk — AI/ML Track

A Django REST Framework backend for an automotive spare-parts distributor. VIKMO DealerDesk helps manage a product catalogue, inventory, dealers, draft orders, AI-assisted part discovery, and machine-learning-based demand forecasts and reorder recommendations.

> **Project track:** AI/ML Intern  
> **Backend:** Django + Django REST Framework  
> **Database:** PostgreSQL  
> **Frontend:** The original assignment deliverable is backend-focused. A separately deployed frontend may be available at the live-site link below.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Main Features](#2-main-features)
- [3. System Architecture](#3-system-architecture)
- [4. Repository Structure](#4-repository-structure)
- [5. Technology Stack](#5-technology-stack)
- [6. Requirements](#6-requirements)
- [7. Environment Configuration](#7-environment-configuration)
- [8. Run the Project Locally](#8-run-the-project-locally)
- [9. Request and Data Workflows](#9-request-and-data-workflows)
- [10. API Reference](#10-api-reference)
- [11. AI Dealer Assistant](#11-ai-dealer-assistant)
- [12. Demand Forecasting and Reorder Recommendations](#12-demand-forecasting-and-reorder-recommendations)
- [13. Testing and Validation](#13-testing-and-validation)
- [14. Deployment](#14-deployment)
- [15. Design Decisions](#15-design-decisions)
- [16. Known Limitations](#16-known-limitations)
- [17. Security Notes](#17-security-notes)
- [18. Video Walkthrough](#18-video-walkthrough)
- [19. Live Application](#19-live-application)

---

## 1. Project Overview

Automotive spare-parts distributors need reliable ways to find parts, maintain stock, prepare dealer orders, and anticipate future demand. VIKMO DealerDesk exposes these capabilities through a REST API.

The project includes:

1. **Catalogue management** — browse, search, create, and update products.
2. **Inventory management** — update stock quantities with a reason.
3. **Dealer management** — list, retrieve, and register dealers.
4. **Order management** — create draft orders and retrieve order information.
5. **AI Dealer Assistant** — answer part-related questions using backend tools and current application data.
6. **Demand forecasting** — serve four-week forecasts for the target SKU set.
7. **Reorder suggestions** — expose stock replenishment recommendations based on forecasts, lead times, and recent sales variation.

The Django backend is the source of truth for product, inventory, dealer, order, assistant, and forecast API responses.

## 2. Main Features

| Module | What it does |
|---|---|
| Health check | Confirms that the API is reachable. |
| Product catalogue | Supports paginated listing, search, product details, creation, and partial updates. |
| Inventory | Allows stock quantities to be adjusted through a validated API. |
| Dealers | Supports dealer listing, details, and registration. |
| Orders | Supports draft-order creation, order listing, and order details. |
| AI assistant | Uses an LLM with tool calling to search parts, check stock, and create draft orders. |
| Forecasting | Provides four weekly demand estimates for each of the 40 target SKUs. |
| Reorder suggestions | Shows current stock, lead-time demand, safety stock, reorder point, and suggested quantity. |

### Scope notes

- The original assignment implementation is backend-focused.
- Supplier synchronization is not implemented.
- The advanced order lifecycle (confirmation, dispatch, delivery, cancellation, GST locking, and concurrency controls) is not implemented.
- A separate frontend can consume the API, but frontend hosting and availability are separate from the backend implementation.

---

## 3. System Architecture

```text
                    Dealer / Warehouse Client
                              |
                              | JSON over HTTP
                              v
                   Django REST Framework API
                              |
              +---------------+----------------+
              |               |                |
              v               v                v
        Product & Stock   Dealer & Order   Assistant / ML
          API views         services       API endpoints
              |               |                |
              +---------------+----------------+
                              |
                              v
                       PostgreSQL
                              ^
                              |
                    Seeded catalogue/dealers

AI assistant:
Django assistant endpoint -> configured LLM provider
                           -> tool-calling loop
                           -> Django tools query/update application data

Forecasting:
Source CSV files -> forecast generation script -> ml/forecast.csv
                                                   |
                                                   v
                                         Forecast/reorder APIs
```

### Important boundaries

- Clients communicate with the backend through HTTP endpoints.
- Django accesses PostgreSQL through the ORM.
- The AI assistant's tools run through the backend; the browser/client does not call the database or LLM provider directly.
- The forecast API serves the committed `ml/forecast.csv` output. Regenerating the file is a separate development step.
- PostgreSQL is required. SQLite is not supported for the assignment run contract.

## 4. Repository Structure

```text
.
├── dealerdesk/
│   ├── settings.py          # Django settings
│   ├── urls.py              # Project URL configuration
│   └── wsgi.py              # WSGI application entry point
├── core/
│   ├── models.py            # Product, Dealer, Order, OrderItem, assistant models
│   ├── serializers.py       # DRF serializers and response formatting
│   ├── views.py             # Product, inventory, dealer, and order APIs
│   ├── assistant_views.py   # LLM assistant and tool-calling loop
│   ├── ml_views.py          # Forecast and reorder endpoints
│   ├── services.py          # Shared business logic, GST, order creation
│   ├── pagination.py        # Standard pagination configuration
│   ├── exceptions.py        # API error-envelope helper
│   ├── urls.py              # Application API routes
│   ├── tests.py             # Unit and integration tests
│   ├── migrations/          # Database migrations
│   └── management/
│       └── commands/
│           └── seed_data.py # Idempotent catalogue/dealer data loader
├── data/                    # Assignment source CSV files (kept unchanged)
├── ml/
│   ├── build_forecast.py    # Forecast generation script
│   └── forecast.csv         # Committed 160-row forecast
├── manage.py
├── requirements.txt
├── .env.example
├── build.sh                 # Deployment build script, if included
├── smoke_test.py
├── DECISIONS.md
└── README.md
```

The exact tree can differ if the repository evolves. Check the current source before relying on any path that may have changed.

## 5. Technology Stack

| Technology | Purpose |
|---|---|
| Python 3.11+ | Backend programming language |
| Django 4.2+ (tested on Django 5.2 according to the project notes) | Web framework |
| Django REST Framework 3.15+ | JSON REST API |
| PostgreSQL | Persistent relational database |
| `google-genai` | Google Gemini integration |
| Gunicorn | Production WSGI server |
| `django-cors-headers` | Cross-origin request configuration when a separate frontend is deployed |
| WhiteNoise | Static-file serving support in the Django deployment |
| CSV / Python forecasting script | Forecast artifact generation |

## 6. Requirements

Before running the project, install or obtain:

- Python 3.11 or later.
- PostgreSQL database access.
- `pip`.
- Git.
- An LLM API key for assistant functionality.
- Access to the project repository and its supplied CSV files.

The assignment requires PostgreSQL. Do not switch to SQLite to work around a database configuration issue.

## 7. Environment Configuration

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Configure the variables required by the actual Django settings:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL. |
| `GEMINI_API_KEY` | Required for the documented primary provider | Google Gemini API key. |
| `OPENAI_API_KEY` | Optional | Alternative/fallback LLM provider key. |
| `ANTHROPIC_API_KEY` | Optional | Alternative/fallback LLM provider key. |
| `GROQ_API_KEY` | Optional | Alternative/fallback LLM provider key. |
| `DJANGO_SECRET_KEY` | Recommended | Django secret key; production must use a secure value. |
| `DJANGO_DEBUG` | Recommended | Set to `0` in production. |
| `SUPPLIER_API_URL` | Optional | Supplier mock URL; documented default is `http://127.0.0.1:8099`. |
| `SUPPLIER_API_KEY` | Optional | Supplier API key for supplier integration, if used. |

Example PostgreSQL URL shape:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Use the actual connection details from your PostgreSQL provider. Do not copy a real password or API key into this README.

### LLM provider configuration

The documented primary provider is Google Gemini using model `gemini-1.5-flash`, configured through `GEMINI_API_KEY`. If that key is absent, the project notes describe a fallback to the first configured key among OpenAI, Anthropic, and Groq. Verify the current implementation before changing provider settings.

### Secret-handling rules

- Keep `.env` out of Git.
- Commit `.env.example` with variable names and safe placeholders only.
- Store production secrets in Render's environment-variable settings.
- If a credential has been exposed in a chat, commit, log, or public repository, revoke or rotate it.

## 8. Run the Project Locally

### Step 1 — Clone the repository

```bash
git clone <your-repository-url>
cd <repository-directory>
```

Replace the placeholders with your repository URL and directory name.

### Step 2 — Create a virtual environment

```bash
python -m venv .venv
```

Activate it:

**Windows PowerShell**

```powershell
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux**

```bash
source .venv/bin/activate
```

### Step 3 — Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4 — Configure PostgreSQL and environment variables

Create or select a PostgreSQL database, then set `DATABASE_URL` and the required LLM key in `.env`. Ensure the project loads these variables using its configured environment mechanism.

### Step 5 — Apply migrations

```bash
python manage.py migrate --noinput
```

This creates or updates the database schema from the committed Django migrations.

### Step 6 — Load initial data

```bash
python manage.py seed_data
python manage.py seed_data
```

The seed command is intended to be idempotent. Running it twice should not create duplicate catalogue/dealer records.

### Step 7 — Generate the forecast (optional)

A forecast CSV is already committed. To regenerate it:

```bash
python ml/build_forecast.py
```

Review the generated changes before committing them.

### Step 8 — Start Django

```bash
python manage.py runserver 0.0.0.0:8000 --noreload
```

The API is then available at `http://localhost:8000/`.

### Grader run contract

The assignment's documented run sequence is:

```bash
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py seed_data
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000 --noreload
```

Run this sequence in an environment with PostgreSQL configured.

## 9. Request and Data Workflows

### 9.1 Product catalogue workflow

1. A client requests `GET /api/products/` with optional search and filter parameters.
2. Django validates the query parameters.
3. The ORM retrieves matching products from PostgreSQL.
4. DRF serializes the records and returns a paginated JSON response.
5. A client can retrieve one product by SKU or use the documented create/update endpoints.

### 9.2 Inventory update workflow

1. A client sends a stock adjustment to `PUT /api/inventory/{sku}/`.
2. Django validates the SKU and quantity.
3. The backend applies the update and records the supplied reason where supported.
4. The response reports the result.
5. A connected frontend should refresh affected product/inventory data after success.

The backend remains responsible for enforcing valid stock quantities.

### 9.3 Draft-order workflow

1. The client sends a dealer ID and one or more SKU/quantity line items to `POST /api/orders/`.
2. Django validates the dealer and product references.
3. Shared service-layer logic creates the draft order and its items.
4. The backend applies the documented GST and order-number logic.
5. The API returns the created order information.
6. The client can retrieve the order later by order number.

### 9.4 Assistant workflow

1. A client submits a session ID, dealer ID, and message.
2. The backend invokes the configured LLM provider.
3. The LLM can request one of the supported backend tools.
4. The backend executes the tool against current application data.
5. Tool results are returned to the LLM for the final response.
6. The API returns the assistant reply and any cited SKUs, tool-call information, or actions supported by the response schema.

### 9.5 Forecast and reorder workflow

1. The forecast-generation script reads the supplied sales and calendar data.
2. It writes the forecast output to `ml/forecast.csv`.
3. The forecast endpoint returns the relevant SKU's weekly forecast.
4. The reorder endpoint combines forecast values, current stock, lead time, and recent sales variation to produce replenishment suggestions.

## 10. API Reference

All paths below include the required trailing slash. Confirm exact response fields in the API implementation and contract.

### 10.1 Health

**`GET /api/health/`**

```bash
curl http://localhost:8000/api/health/
```

Expected example:

```json
{
  "status": "ok"
}
```

### 10.2 Products

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/products/` | List and search products |
| `GET` | `/api/products/{sku}/` | Retrieve product details |
| `POST` | `/api/products/` | Create a product |
| `PATCH` | `/api/products/{sku}/` | Partially update a product |

List products:

```bash
curl "http://localhost:8000/api/products/?page_size=5"
```

Search products by term and vehicle:

```bash
curl "http://localhost:8000/api/products/?search=brake&vehicle=Pulsar"
```

Retrieve a product:

```bash
curl http://localhost:8000/api/products/BRK-1044/
```

Create a product:

```bash
curl -X POST http://localhost:8000/api/products/ \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TST-001",
    "name": "Test",
    "category": "Brakes",
    "brand": "X",
    "vehicle_fitment": "Universal",
    "price": "100.00",
    "description": ""
  }'
```

Partially update a product:

```bash
curl -X PATCH http://localhost:8000/api/products/TST-001/ \
  -H "Content-Type: application/json" \
  -d '{"price": "120.00"}'
```

### 10.3 Inventory

**`PUT /api/inventory/{sku}/`**

```bash
curl -X PUT http://localhost:8000/api/inventory/BRK-1044/ \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50,
    "reason": "stock count correction"
  }'
```

### 10.4 Dealers

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/dealers/` | List dealers |
| `GET` | `/api/dealers/{id}/` | Retrieve dealer details |
| `POST` | `/api/dealers/` | Register a dealer |

List dealers:

```bash
curl http://localhost:8000/api/dealers/
```

Retrieve a dealer:

```bash
curl http://localhost:8000/api/dealers/1/
```

Register a dealer:

```bash
curl -X POST http://localhost:8000/api/dealers/ \
  -H "Content-Type: application/json" \
  -d '{"dealer_code": "DLR-026", "name": "New Dealer"}'
```

### 10.5 Orders

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/orders/` | Create a draft order |
| `GET` | `/api/orders/` | List orders, optionally filtered |
| `GET` | `/api/orders/{order_number}/` | Retrieve order details |

Create a draft order:

```bash
curl -X POST http://localhost:8000/api/orders/ \
  -H "Content-Type: application/json" \
  -d '{
    "dealer_id": 1,
    "items": [
      {"sku": "BRK-1044", "quantity": 3}
    ]
  }'
```

List orders by dealer and status:

```bash
curl "http://localhost:8000/api/orders/?dealer_id=1&status=DRAFT"
```

Retrieve an order:

```bash
curl http://localhost:8000/api/orders/ORD-20261012-0001/
```

The order number above is an example format. Use the actual order number returned by the API.

### 10.6 AI Dealer Assistant

**`POST /api/assistant/chat/`**

```bash
curl -X POST http://localhost:8000/api/assistant/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "sess-001",
    "dealer_id": 1,
    "message": "Do you have brake pads for Pulsar 150?"
  }'
```

The response can include an assistant reply, cited SKUs, tool-call information, and actions as defined by the implementation.

### 10.7 Forecasting and reorder suggestions

Retrieve the forecast for a SKU:

```bash
curl http://localhost:8000/api/forecast/BRK-1090/
```

Retrieve reorder suggestions:

```bash
curl http://localhost:8000/api/reorder-suggestions/
```

### Pagination

The documented paginated response shape is:

```json
{
  "count": 0,
  "next": null,
  "previous": null,
  "results": []
}
```

The default page size is 20 and the maximum page size is 100, according to the project specification.

### Error handling

The documented standard error envelope is:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation",
    "details": []
  }
}
```

The client should handle validation errors, missing resources, duplicate records, server failures, and network errors without assuming that every error has identical details.

## 11. AI Dealer Assistant

### Purpose

The assistant helps a dealer ask questions about spare parts and inventory using an LLM connected to backend tools. It is not intended to invent stock levels or create orders without executing the corresponding backend operation.

### Supported tools

| Tool | Purpose |
|---|---|
| `search_parts` | Search the product catalogue for matching parts. |
| `check_stock` | Check current stock through backend data. |
| `create_draft_order` | Create a draft order through shared backend business logic. |

### Retrieval strategy

The `search_parts` tool uses PostgreSQL `ILIKE` keyword matching over product name, category, and SKU fields. This avoids a paid vector database and keeps the search reproducible.

A vector-search design could use `pgvector` and sentence-transformers, but that is a potential future improvement rather than the current implementation.

### Provider configuration

- Primary provider documented: Google Gemini.
- Model documented: `gemini-1.5-flash`.
- Primary environment variable: `GEMINI_API_KEY`.
- The project notes specify fallback providers through OpenAI, Anthropic, and Groq keys.

Provider availability and SDK compatibility depend on the installed SDK versions and current API support. Check the implementation and provider logs when diagnosing errors.

## 12. Demand Forecasting and Reorder Recommendations

### Forecast output

The committed file `ml/forecast.csv` is expected to contain:

- 40 target SKUs.
- Four weekly forecast dates per SKU.
- 160 total rows.
- Columns: `sku`, `week_start`, `forecast_units`.

The documented forecast dates are:

- `2026-09-28`
- `2026-10-05`
- `2026-10-12`
- `2026-10-19`

### Forecasting method

The project notes describe a statistical heuristic:

- Blended trailing four-week average.
- Same-week-last-year comparison when at least 52 weeks of history are available, using a documented 60/40 blend.
- Diwali festive lift, up to `×1.30` within three weeks of `2026-11-08`.
- Promotion lift of `×1.45` when `promo_flag=1`.
- Category-median baseline for new or infrequently sold SKUs.

This is a heuristic forecast rather than a trained production time-series model.

### Reorder calculations

The documented reorder logic uses lead-time demand and a safety-stock buffer:

- `lead_time_demand` = sum of the forecast demand over the lead-time horizon.
- `sigma` = sample standard deviation of the most recent 12 sales weeks.
- `safety_stock` = `ceil(1.65 × sigma × sqrt(L))`.
- `reorder_point` = `lead_time_demand + safety_stock`.
- `reorder_qty` = `max(0, ceil(reorder_point - current_stock))`.

Here, `L` is lead time in the unit used by the implementation. Confirm that the sales-week and lead-time units are consistent when reviewing the calculation.

### Regenerate and validate the CSV

Regenerate:

```bash
python ml/build_forecast.py
```

Validate the output:

```bash
python -c "
import csv

with open('ml/forecast.csv', newline='', encoding='utf-8') as file:
    rows = list(csv.DictReader(file))

print(f'Rows: {len(rows)}')
assert len(rows) == 160

pairs = {(row['sku'], row['week_start']) for row in rows}
assert len(pairs) == 160
assert all(float(row['forecast_units']) >= 0 for row in rows)

print('Forecast CSV valid')
"
```

### Backtesting note

The project notes report a backtest MAE of **12.48 units** on a `2026-09-21` holdout across 40 SKUs. Treat this as a project-reported metric; rerun the backtest to independently verify it after modifying the model or input data.

## 13. Testing and Validation

### Run the Django test suite

The database must be configured and reachable.

```bash
python manage.py test
```

### Run the assignment smoke test

Start the server in one terminal:

```bash
python manage.py runserver 0.0.0.0:8000 --noreload
```

Then run the smoke test in another terminal:

```bash
python smoke_test.py --base-url http://localhost:8000 --track aiml
```

### Recommended verification sequence

1. Confirm the environment points to PostgreSQL.
2. Apply migrations.
3. Run the seed command twice and check that duplicate data is not created.
4. Run the Django tests.
5. Run the smoke test against the running server.
6. Validate the forecast CSV row count, uniqueness, dates, and non-negative values.
7. Exercise the assistant with catalogue-search and stock-check questions.
8. Verify that draft-order creation uses real backend service logic.
9. Inspect server logs for unhandled errors.
10. Record actual test results rather than claiming checks passed without execution evidence.

## 14. Deployment

The backend can be hosted as a Render Web Service with Neon PostgreSQL as its database. If a separate React frontend is used, deploy it as a Render Static Site.

### Backend service

Typical Render settings:

- Runtime: Python.
- Build command: `bash build.sh` if the script exists and has the expected contents.
- Start command:

```bash
gunicorn dealerdesk.wsgi:application --bind 0.0.0.0:$PORT
```

Do not hardcode the port. Render provides the service port through `$PORT`.

Set production environment variables in Render's dashboard. At minimum, configure the database URL, a secure Django secret, production debug settings, and the LLM key needed by the assistant.

### Frontend service (if deployed separately)

For a Vite frontend in `Frontend/`, typical settings are:

- Root directory: `Frontend`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_URL=https://<actual-backend-hostname>`

Use the actual backend URL assigned by Render. Configure Django CORS to allow the exact frontend origin; do not enable unrestricted origins as a production shortcut.

### Deployment verification

After deployment:

1. Open the backend health endpoint.
2. Check a database-backed API endpoint.
3. Verify the frontend points to the live backend URL.
4. Test catalogue, inventory, orders, assistant, and forecast workflows.
5. Check browser console and Render logs.
6. Confirm no secrets are included in GitHub or the frontend build.

### Live service

The supplied live-site URL is listed in [Live Application](#19-live-application). Its current availability and feature completeness should be verified before sharing it publicly.

## 15. Design Decisions

The project notes identify these main decisions:

1. **Single `core` Django app** — keeps the assignment implementation simple and avoids over-engineering a single-track project.
2. **Stock stored directly on `Product`** — the documented contract describes one stock quantity per product and does not require warehouse-level stock splits.
3. **Shared service layer** — the REST API and assistant's `create_draft_order` tool use the same order-creation logic to avoid divergent behavior.
4. **Forecast served from a committed CSV** — makes the forecast endpoint deterministic and aligned with the committed output file.
5. **PostgreSQL keyword search** — uses `ILIKE` for reproducible catalogue search without a separate paid vector database.

See `DECISIONS.md` for the assignment-specific decision questions and supporting code references.

## 16. Known Limitations

1. `search_parts` uses keyword `ILIKE` search rather than semantic embeddings, so paraphrased queries may be less effective.
2. The Gemini function-calling integration targets `google-genai>=1.0` and the documented `protos` namespace; SDK changes may require compatibility updates.
3. The order-number sequence uses `SELECT FOR UPDATE SKIP LOCKED`. The project notes recommend replacing this with a database sequence for stronger production behavior.
4. The forecasting method is a statistical heuristic; a trained model such as Prophet or LightGBM could be evaluated with additional engineering and backtesting.
5. Supplier synchronization is not implemented.
6. Advanced order lifecycle transitions and related production controls are not implemented.

## 17. Security Notes

- Never commit `.env` or real API keys.
- Rotate any credentials that have been exposed.
- Keep `DEBUG` disabled in production.
- Use a strong `DJANGO_SECRET_KEY`.
- Configure `ALLOWED_HOSTS` and CORS for the actual deployment domains.
- Use HTTPS database connections as required by the database provider.
- Do not expose database credentials or LLM API keys to frontend code.
- Validate inputs and rely on backend authorization and business rules for consequential actions.
- Treat model output as untrusted input; sanitize any rendered assistant content in a frontend.
- Review logs to ensure they do not disclose secrets.

## 18. Video Walkthrough

[Code Review Video](https://drive.google.com/file/d/1cKQyQ7ZH40GRDb5UQfCAXfZZRxuH1JMr/view?usp=sharing)

## 19. Live Application

[Open VIKMO DealerDesk](https://vikmo-dealerdesk-application-1.onrender.com/)

The URL was supplied with the project notes. Verify that it is current and reachable before using it in a portfolio or submission.

---

## Quick Start Summary

For a fast local setup, after configuring PostgreSQL and `.env`:

```bash
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py seed_data
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000 --noreload
```

Then open `http://localhost:8000/api/health/` and run:

```bash
python manage.py test
python smoke_test.py --base-url http://localhost:8000 --track aiml
```

For deployment and provider-specific behavior, follow the detailed sections above and verify each step against the current repository configuration.
