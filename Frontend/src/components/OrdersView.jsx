import React, { useState, useEffect } from 'react';
import { useDealer } from '../context/DealerContext';
import { getOrders, createDraftOrder, getOrderDetail } from '../api/client';
import {
  ShoppingCart,
  Trash2,
  CheckCircle,
  FileText,
  Clock,
  ArrowRight,
  Eye,
  X,
  PackageCheck,
} from 'lucide-react';

export default function OrdersView({ onNavigateToCatalogue }) {
  const { activeDealer, cart, removeFromCart, updateCartQuantity, clearCart, cartTotals, showToast } =
    useDealer();

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [inspectingOrder, setInspectingOrder] = useState(null);

  const fetchOrdersList = async () => {
    try {
      setLoadingOrders(true);
      const params = { page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      if (activeDealer) params.dealer_id = activeDealer.id;

      const res = await getOrders(params);
      setOrders(res.results || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrdersList();
  }, [activeDealer, statusFilter]);

  const handleCheckoutDraft = async () => {
    if (!activeDealer) {
      showToast('Please select an active dealer before creating an order.', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('Your draft cart is empty.', 'error');
      return;
    }

    try {
      setSubmittingOrder(true);
      const itemsPayload = cart.map((item) => ({
        sku: item.sku,
        quantity: parseInt(item.quantity, 10),
      }));

      const res = await createDraftOrder(activeDealer.id, itemsPayload);
      showToast(`Draft Order ${res.order_number} created successfully!`, 'success');
      clearCart();
      fetchOrdersList();
    } catch (err) {
      showToast(err.message || 'Failed to generate draft order', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleViewOrderDetail = async (orderNumber) => {
    try {
      const detail = await getOrderDetail(orderNumber);
      setInspectingOrder(detail);
    } catch (err) {
      showToast('Failed to load order details', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Active Draft Cart Builder */}
      <div className="card-surface" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
              Draft Order Cart
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Building order for: <strong>{activeDealer ? activeDealer.name : 'No Dealer Selected'}</strong>
            </p>
          </div>

          {cart.length > 0 && (
            <button className="btn btn-ghost" style={{ color: 'var(--status-critical)' }} onClick={clearCart}>
              Clear Cart
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--surface-panel)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-medium)',
            }}
          >
            <ShoppingCart size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Your active draft cart is empty. Browse the catalogue or ask the AI Dealer Assistant to add components.
            </p>
            <button className="btn btn-primary" onClick={onNavigateToCatalogue}>
              Browse 600 Catalogue SKUs
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Part Name</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const price = parseFloat(item.unit_price) || 0;
                    const lineSubtotal = (price * item.quantity).toFixed(2);
                    return (
                      <tr key={item.sku}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {item.sku}
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                          ₹{price.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem' }}
                              onClick={() => updateCartQuantity(item.sku, item.quantity - 1)}
                            >
                              -
                            </button>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: '24px' }}>
                              {item.quantity}
                            </span>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem' }}
                              onClick={() => updateCartQuantity(item.sku, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                          ₹{lineSubtotal}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ color: 'var(--status-critical)', padding: '0.3rem' }}
                            onClick={() => removeFromCart(item.sku)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cart Summary Bar */}
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--surface-panel)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    ITEMS SUBTOTAL
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600 }}>
                    ₹{cartTotals.subtotal}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    GST (18%)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600 }}>
                    ₹{cartTotals.taxTotal}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    GRAND TOTAL
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    ₹{cartTotals.grandTotal}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
                disabled={submittingOrder}
                onClick={handleCheckoutDraft}
              >
                {submittingOrder ? 'Submitting...' : 'Generate DRAFT Order →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Orders History Table */}
      <div className="card-surface" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
              Order History & Dispatches
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Tracking generated wholesale purchase orders for active dealership accounts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
              style={{ width: '180px' }}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Dealer Code</th>
                <th>Lines</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No orders registered yet. Create your first draft above!
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_number}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {o.order_number}
                    </td>
                    <td>
                      <span className="badge badge-draft">Dealer #{o.dealer_id}</span>
                    </td>
                    <td>{o.items?.length || 0} items</td>
                    <td>
                      <span
                        className={`badge ${
                          o.status === 'DRAFT'
                            ? 'badge-draft'
                            : o.status === 'CONFIRMED'
                            ? 'badge-optimal'
                            : o.status === 'DISPATCHED'
                            ? 'badge-transit'
                            : 'badge-warning'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                      ₹{parseFloat(o.grand_total || 0).toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(o.created_at).toLocaleDateString()} {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleViewOrderDetail(o.order_number)}
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {inspectingOrder && (
        <div className="modal-backdrop" onClick={() => setInspectingOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge badge-draft" style={{ marginBottom: '0.4rem' }}>
                  {inspectingOrder.status}
                </span>
                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
                  Order: {inspectingOrder.order_number}
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Dealer Account #{inspectingOrder.dealer_id}
                </span>
              </div>
              <button className="btn btn-ghost" onClick={() => setInspectingOrder(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inspectingOrder.items || []).map((it) => (
                    <tr key={it.sku}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{it.sku}</td>
                      <td>{it.name}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{it.quantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{it.unit_price}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{it.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '1rem', background: 'var(--surface-panel)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                <span>Subtotal:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{inspectingOrder.subtotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                <span>GST Tax (18%):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{inspectingOrder.tax_total}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-medium)', paddingTop: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                <span>Grand Total:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>₹{inspectingOrder.grand_total}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setInspectingOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
