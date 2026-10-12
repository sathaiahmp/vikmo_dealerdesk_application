import React, { useState, useEffect } from 'react';
import { getProducts, updateInventory } from '../api/client';
import { useDealer } from '../context/DealerContext';
import {
  Boxes,
  Search,
  Check,
  RefreshCw,
  AlertCircle,
  History,
  SlidersHorizontal,
} from 'lucide-react';

export default function InventoryManagement({ initialSku = '' }) {
  const { showToast } = useDealer();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSku);

  // Quick Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [newQuantity, setNewQuantity] = useState(0);
  const [reason, setReason] = useState('Stock count audit');
  const [submitting, setSubmitting] = useState(false);

  const loadStockList = async () => {
    try {
      setLoading(true);
      const res = await getProducts({ search: searchTerm.trim(), page_size: 40 });
      setProducts(res.results || []);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
      showToast('Failed to load inventory records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStockList();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOpenEdit = (product) => {
    setEditingItem(product);
    setNewQuantity(product.stock);
    setReason('Stock count audit');
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      showToast('Quantity must be an integer >= 0', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await updateInventory(editingItem.sku, qty, reason);
      showToast(`Updated stock for ${editingItem.sku} to ${qty} units.`, 'success');

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p.sku === editingItem.sku ? { ...p, stock: qty } : p))
      );
      setEditingItem(null);
    } catch (err) {
      showToast(err.message || 'Failed to update inventory', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div
        className="card-surface"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
            Inventory Management & Stock Auditing
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Modify live physical warehouse on-hand quantities via <code>PUT /api/inventory/&#123;sku&#125;/</code>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search parts by SKU or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          <button className="btn btn-secondary" onClick={loadStockList} title="Refresh Live Quantities">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Part Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Unit Price</th>
              <th style={{ textAlign: 'center' }}>Available Stock</th>
              <th style={{ textAlign: 'right' }}>Inventory Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Reading live stock values from PostgreSQL...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No parts found matching query.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.sku}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {p.sku}
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.category}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                    ₹{parseFloat(p.price).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className={`badge ${
                        p.stock === 0
                          ? 'badge-critical'
                          : p.stock < 15
                          ? 'badge-warning'
                          : 'badge-optimal'
                      }`}
                    >
                      {p.stock} Units
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => handleOpenEdit(p)}
                    >
                      <SlidersHorizontal size={14} /> Adjust Stock
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stock Adjustment Modal */}
      {editingItem && (
        <div className="modal-backdrop" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Adjust Live Inventory: {editingItem.sku}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {editingItem.name}
            </p>

            <form onSubmit={handleSaveStock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  NEW AVAILABLE QUANTITY (INTEGER ≥ 0)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  AUDIT / REASON NOTE
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Stock count correction"
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Save Stock Quantity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
