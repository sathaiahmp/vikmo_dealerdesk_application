/**
 * VIKMO DealerDesk API Client
 * Connects to Django REST backend with contract error envelopes and trailing slashes.
 */

// Use VITE_API_URL if deployed separately, or relative path if proxied/co-hosted
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // Abort controller for timeout — default 30s, assistant uses 90s
  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  const config = {
    ...options,
    headers,
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, config);
    clearTimeout(timerId);

    const contentType = res.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errorMsg = data?.error?.message || `Request failed with status ${res.status}`;
      const errorCode = data?.error?.code || 'UNKNOWN_ERROR';
      const errorDetails = data?.error?.details || [];
      const error = new Error(errorMsg);
      error.code = errorCode;
      error.status = res.status;
      error.details = errorDetails;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timerId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs / 1000}s. The AI assistant may be busy — please try again.`);
      timeoutErr.code = 'TIMEOUT';
      console.error(`API Timeout [${options.method || 'GET'} ${url}]`);
      throw timeoutErr;
    }
    console.error(`API Error [${options.method || 'GET'} ${url}]:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export const getHealth = () => apiRequest('/api/health/');

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const getProducts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.page_size) query.set('page_size', params.page_size);
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.vehicle) query.set('vehicle', params.vehicle);

  const qs = query.toString();
  return apiRequest(`/api/products/${qs ? `?${qs}` : ''}`);
};

export const getProductDetail = (sku) => apiRequest(`/api/products/${encodeURIComponent(sku)}/`);

export const createProduct = (payload) =>
  apiRequest('/api/products/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateProduct = (sku, payload) =>
  apiRequest(`/api/products/${encodeURIComponent(sku)}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export const updateInventory = (sku, quantity, reason = '') =>
  apiRequest(`/api/inventory/${encodeURIComponent(sku)}/`, {
    method: 'PUT',
    body: JSON.stringify({ quantity, reason }),
  });

// ---------------------------------------------------------------------------
// Dealers
// ---------------------------------------------------------------------------
export const getDealers = (page = 1, pageSize = 50) =>
  apiRequest(`/api/dealers/?page=${page}&page_size=${pageSize}`);

export const getDealerDetail = (id) => apiRequest(`/api/dealers/${id}/`);

export const createDealer = (payload) =>
  apiRequest('/api/dealers/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const getOrders = (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.page_size) query.set('page_size', params.page_size);
  if (params.dealer_id) query.set('dealer_id', params.dealer_id);
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  return apiRequest(`/api/orders/${qs ? `?${qs}` : ''}`);
};

export const getOrderDetail = (orderNumber) =>
  apiRequest(`/api/orders/${encodeURIComponent(orderNumber)}/`);

export const createDraftOrder = (dealerId, items) =>
  apiRequest('/api/orders/', {
    method: 'POST',
    body: JSON.stringify({ dealer_id: dealerId, items }),
  });

// ---------------------------------------------------------------------------
// AI Dealer Assistant
// ---------------------------------------------------------------------------
export const sendAssistantMessage = (sessionId, dealerId, message) =>
  apiRequest('/api/assistant/chat/', {
    method: 'POST',
    timeoutMs: 90000, // 90s — tool-calling loop can take multiple LLM rounds
    body: JSON.stringify({
      session_id: sessionId,
      dealer_id: dealerId,
      message,
    }),
  });

// ---------------------------------------------------------------------------
// Forecasting & Reorder Suggestions
// ---------------------------------------------------------------------------
export const getSkuForecast = (sku) =>
  apiRequest(`/api/forecast/${encodeURIComponent(sku)}/`);

export const getReorderSuggestions = () =>
  apiRequest('/api/reorder-suggestions/');
