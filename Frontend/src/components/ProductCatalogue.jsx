import React, { useState, useEffect } from 'react';
import { getProducts } from '../api/client';
import { useDealer } from '../context/DealerContext';
import {
  Search,
  Filter,
  Plus,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Package,
} from 'lucide-react';

export default function ProductCatalogue({ onAdjustStock }) {
  const { addToCart } = useDealer();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');

  // Product Inspection Modal State
  const [inspectingProduct, setInspectingProduct] = useState(null);

  const categories = [
    'Brakes',
    'Electrical',
    'Engine',
    'Consumables',
    'Suspension',
    'Transmission',
    'Chassis',
    'Accessories',
  ];

  const fetchCatalogue = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: pageSize,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (vehicleFilter.trim()) params.vehicle = vehicleFilter.trim();

      const data = await getProducts(params);
      setProducts(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load catalogue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 on filter changes
    setPage(1);
  }, [searchTerm, selectedCategory, vehicleFilter]);

  useEffect(() => {
    fetchCatalogue();
  }, [page, searchTerm, selectedCategory, vehicleFilter]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getStockBadge = (stock) => {
    if (stock <= 0) return <span className="badge badge-critical">Out of Stock ({stock})</span>;
    if (stock < 15) return <span className="badge badge-warning">Low ({stock})</span>;
    return <span className="badge badge-optimal">In Stock ({stock})</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls Bar */}
      <div
        className="card-surface"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
              Spare-Parts Catalogue
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Showing {products.length} of {totalCount} genuine motorcycle components.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
              setVehicleFilter('');
            }}
          >
            Clear Filters
          </button>
        </div>

        {/* Filter Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search SKU, name, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-field"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Vehicle Fitment Filter */}
          <input
            type="text"
            placeholder="Filter by vehicle (e.g. Pulsar 150)..."
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Catalogue Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Part Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Fitment</th>
              <th style={{ textAlign: 'right' }}>Price (INR)</th>
              <th style={{ textAlign: 'center' }}>Stock</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading parts catalogue from Neon PostgreSQL...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No spare parts found matching the specified search or filter criteria.
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
                  <td>{p.brand}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.vehicle_fitment}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                    ₹{parseFloat(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>{getStockBadge(p.stock)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                        title="View Detailed Specs"
                        onClick={() => setInspectingProduct(p)}
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                        title="Add 1 to Draft Cart"
                        onClick={() => addToCart(p, 1)}
                      >
                        <ShoppingCart size={14} /> Add
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div
        className="card-surface"
        style={{
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Page {page} of {totalPages} (Total: {totalCount})
        </span>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            style={{ opacity: page <= 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            style={{ opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Product Detail Modal */}
      {inspectingProduct && (
        <div className="modal-backdrop" onClick={() => setInspectingProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge badge-optimal" style={{ marginBottom: '0.4rem' }}>
                  {inspectingProduct.category}
                </span>
                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
                  {inspectingProduct.name}
                </h3>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  {inspectingProduct.sku}
                </span>
              </div>
              <button className="btn btn-ghost" onClick={() => setInspectingProduct(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--surface-panel)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>BRAND</div>
                <div style={{ fontWeight: 600 }}>{inspectingProduct.brand}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--surface-panel)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>FITMENT</div>
                <div style={{ fontWeight: 600 }}>{inspectingProduct.vehicle_fitment}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--surface-panel)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>UNIT PRICE</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                  ₹{parseFloat(inspectingProduct.price).toFixed(2)}
                </div>
              </div>
              <div style={{ padding: '0.75rem', background: 'var(--surface-panel)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>AVAILABLE STOCK</div>
                <div>{getStockBadge(inspectingProduct.stock)}</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Item Description (Untrusted Catalogue Content)
              </h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.6, background: '#faf9f6', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-hairline)' }}>
                {inspectingProduct.description || 'No additional technical notes supplied for this SKU.'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (onAdjustStock) onAdjustStock(inspectingProduct.sku);
                  setInspectingProduct(null);
                }}
              >
                Adjust Stock
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  addToCart(inspectingProduct, 1);
                  setInspectingProduct(null);
                }}
              >
                Add to Draft Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
