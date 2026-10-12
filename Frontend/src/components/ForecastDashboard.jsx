import React, { useState, useEffect } from 'react';
import { useDealer } from '../context/DealerContext';
import { getReorderSuggestions, getSkuForecast } from '../api/client';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ShoppingCart,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';

export default function ForecastDashboard() {
  const { addToCart, showToast } = useDealer();

  const [reorders, setReorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'critical'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReorderMatrix = async () => {
    try {
      setLoading(true);
      const res = await getReorderSuggestions();
      const list = res.results || [];
      setReorders(list);
      if (list.length > 0 && !selectedSku) {
        setSelectedSku(list[0].sku);
      }
    } catch (err) {
      console.error('Failed to fetch reorder suggestions:', err);
      showToast('Failed to load ML reorder matrix.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReorderMatrix();
  }, []);

  // Fetch 4-week forecast when selectedSku changes
  useEffect(() => {
    if (!selectedSku) return;
    async function loadForecast() {
      try {
        setLoadingForecast(true);
        const res = await getSkuForecast(selectedSku);
        setForecastData(res);
      } catch (err) {
        console.error('Failed to load SKU forecast:', err);
      } finally {
        setLoadingForecast(false);
      }
    }
    loadForecast();
  }, [selectedSku]);

  const filteredReorders = reorders.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterMode === 'critical') return item.reorder_qty > 0;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Banner */}
      <div
        className="card-surface"
        style={{
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '5px solid var(--color-primary)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.35rem', fontWeight: 700 }}>
              Machine Learning Sales Forecast & Dynamic Reorder Engine
            </h2>
            <span className="badge badge-optimal">160 Rows Pre-Calculated</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Predictive demand for 40 target SKUs across 4 upcoming weeks based on historical sales, YoY trajectory, Diwali festive lift, and promo calendar.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchReorderMatrix}>
          <RefreshCw size={14} /> Refresh Live Stock
        </button>
      </div>

      {/* Selected SKU 4-Week Demand Visualizer */}
      <div className="card-surface" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              PROJECTED SALES TRAJECTORY
            </span>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', fontWeight: 700 }}>
              Target SKU: <span style={{ color: 'var(--color-primary)' }}>{selectedSku || 'Select SKU below'}</span>
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-transit">
              <Sparkles size={12} /> Model: YoY Blend + Diwali Lift
            </span>
          </div>
        </div>

        {loadingForecast ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading 4-week projections for {selectedSku}...
          </div>
        ) : !forecastData || !forecastData.forecast ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Select an SKU from the matrix table below to inspect its weekly forecast.
          </div>
        ) : (
          <div>
            {/* Visual Bars for the 4 Mondays */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1rem',
                margin: '1.5rem 0 1rem',
              }}
            >
              {forecastData.forecast.map((fw, idx) => {
                const maxUnits = Math.max(...forecastData.forecast.map((f) => f.forecast_units), 10);
                const heightPct = Math.min(Math.max((fw.forecast_units / maxUnits) * 100, 15), 100);
                return (
                  <div
                    key={fw.week_start}
                    style={{
                      background: 'var(--surface-panel)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Week {idx + 1} ({fw.week_start})
                    </div>

                    <div
                      style={{
                        height: '110px',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        margin: '0.5rem 0',
                      }}
                    >
                      <div
                        style={{
                          height: `${heightPct}%`,
                          width: '48px',
                          background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                          borderRadius: '4px 4px 0 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          transition: 'height 0.4s ease',
                        }}
                      >
                        {Math.round(fw.forecast_units)}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Forecast Units
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: '#faf8f5', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              Note: The 4-week forecast values are served directly from the validated, backtested <code>ml/forecast.csv</code> (MAE 12.48), with zero training leakage from future weeks.
            </div>
          </div>
        )}
      </div>

      {/* 40-SKU Reorder Matrix Table */}
      <div className="card-surface" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', fontWeight: 700 }}>
              Safety Stock & Reorder Suggestions Matrix (40 Target SKUs)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Formula: Safety Stock $S = \lceil 1.65 \times \sigma \times \sqrt&#123;L&#125; \rceil$, Reorder Point $ROP = D_L + S$, Suggested $Q = \max(0, \lceil ROP - \text&#123;Stock&#125; \rceil)$
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>

            <div style={{ display: 'inline-flex', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <button
                className="btn"
                style={{
                  borderRadius: 0,
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.75rem',
                  backgroundColor: filterMode === 'all' ? 'var(--color-primary)' : '#ffffff',
                  color: filterMode === 'all' ? '#ffffff' : 'var(--text-main)',
                }}
                onClick={() => setFilterMode('all')}
              >
                All 40 SKUs
              </button>
              <button
                className="btn"
                style={{
                  borderRadius: 0,
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.75rem',
                  backgroundColor: filterMode === 'critical' ? 'var(--status-critical)' : '#ffffff',
                  color: filterMode === 'critical' ? '#ffffff' : 'var(--text-main)',
                }}
                onClick={() => setFilterMode('critical')}
              >
                Critical Only
              </button>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target SKU</th>
                <th style={{ textAlign: 'center' }}>Current Stock</th>
                <th style={{ textAlign: 'center' }}>Lead Time (L)</th>
                <th style={{ textAlign: 'center' }}>Lead Demand (D_L)</th>
                <th style={{ textAlign: 'center' }}>Safety Stock (S)</th>
                <th style={{ textAlign: 'center' }}>Reorder Point (ROP)</th>
                <th style={{ textAlign: 'center' }}>Suggested Qty (Q)</th>
                <th style={{ textAlign: 'right' }}>Reorder Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Computing live safety stock and reorder points...
                  </td>
                </tr>
              ) : filteredReorders.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No items match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredReorders.map((item) => {
                  const isSelected = selectedSku === item.sku;
                  const isCritical = item.reorder_qty > 0;
                  return (
                    <tr
                      key={item.sku}
                      style={{
                        backgroundColor: isSelected ? '#fff9f4' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedSku(item.sku)}
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {item.sku}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {item.current_stock}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {item.lead_time_weeks} wks
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {Math.round(item.lead_time_demand)}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {item.safety_stock}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {Math.round(item.reorder_point)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isCritical ? 'badge-critical' : 'badge-optimal'}`}>
                          {item.reorder_qty > 0 ? `+${item.reorder_qty} Units` : 'Stock OK (0)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary"
                          style={{
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.75rem',
                            opacity: isCritical ? 1 : 0.6,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const qtyToAdd = isCritical ? item.reorder_qty : 10;
                            addToCart({ sku: item.sku, name: item.sku, price: '0.00' }, qtyToAdd);
                          }}
                        >
                          <ShoppingCart size={13} /> {isCritical ? `Order ${item.reorder_qty}` : 'Add 10'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
