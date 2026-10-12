import React, { useState } from 'react';
import { DealerProvider, useDealer } from './context/DealerContext';
import Navigation from './components/Navigation';
import OperationsOverview from './components/OperationsOverview';
import ProductCatalogue from './components/ProductCatalogue';
import InventoryManagement from './components/InventoryManagement';
import DealerPortal from './components/DealerPortal';
import OrdersView from './components/OrdersView';
import DealerAssistant from './components/DealerAssistant';
import ForecastDashboard from './components/ForecastDashboard';
import { ShoppingCart, Store, ChevronDown, Check, AlertCircle, Info } from 'lucide-react';

function AppShell() {
  const [activeTab, setActiveTab] = useState('overview');
  const [inventoryPreselectedSku, setInventoryPreselectedSku] = useState('');

  const { dealers, activeDealer, setActiveDealer, cart, toast } = useDealer();
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  const navigateToInventoryWithSku = (sku) => {
    setInventoryPreselectedSku(sku);
    setActiveTab('inventory');
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor:
              toast.type === 'error'
                ? 'var(--status-critical)'
                : toast.type === 'success'
                ? 'var(--status-optimal)'
                : 'var(--color-secondary)',
            color: '#ffffff',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={18} />
          ) : toast.type === 'success' ? (
            <Check size={18} />
          ) : (
            <Info size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              MODULE:
            </span>
            <span
              style={{
                fontFamily: 'var(--font-headline)',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'var(--text-main)',
              }}
            >
              {activeTab === 'overview' && 'Operations Overview'}
              {activeTab === 'catalogue' && 'Parts Catalogue (600 Items)'}
              {activeTab === 'inventory' && 'Inventory Stock Auditing'}
              {activeTab === 'dealers' && 'Authorized Dealerships (25 Accounts)'}
              {activeTab === 'orders' && 'Wholesale Orders & Draft Checkout'}
              {activeTab === 'assistant' && 'AI Dealer Assistant (Gemini 3.8 Flash)'}
              {activeTab === 'forecast' && 'ML Sales Forecasting & Reorder Matrix'}
            </span>
          </div>

          {/* Right Controls: Dealer Selector & Cart Shortcut */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Active Dealer Dropdown Selector */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                onClick={() => setShowDealerDropdown(!showDealerDropdown)}
              >
                <Store size={15} color="var(--color-primary)" />
                <span>
                  {activeDealer ? `${activeDealer.name} (${activeDealer.dealer_code})` : 'Select Active Dealer'}
                </span>
                <ChevronDown size={14} />
              </button>

              {showDealerDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.35rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                    width: '300px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    zIndex: 100,
                  }}
                >
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'var(--surface-panel)',
                      borderBottom: '1px solid var(--border-hairline)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    SELECT ACTIVE BUYER CONTEXT:
                  </div>
                  {dealers.map((d) => (
                    <button
                      key={d.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        border: 'none',
                        background: activeDealer?.id === d.id ? '#fff8f2' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        borderBottom: '1px solid var(--border-hairline)',
                      }}
                      onClick={() => {
                        setActiveDealer(d);
                        setShowDealerDropdown(false);
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {d.dealer_code} • {d.city || 'Regional Hub'}
                        </div>
                      </div>
                      {activeDealer?.id === d.id && <Check size={16} color="var(--color-primary)" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Shortcut Button */}
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
              onClick={() => setActiveTab('orders')}
            >
              <ShoppingCart size={15} />
              <span>Cart ({cart.length})</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="page-wrapper">
          {activeTab === 'overview' && <OperationsOverview onNavigate={setActiveTab} />}
          {activeTab === 'catalogue' && (
            <ProductCatalogue onAdjustStock={navigateToInventoryWithSku} />
          )}
          {activeTab === 'inventory' && (
            <InventoryManagement initialSku={inventoryPreselectedSku} />
          )}
          {activeTab === 'dealers' && <DealerPortal />}
          {activeTab === 'orders' && (
            <OrdersView onNavigateToCatalogue={() => setActiveTab('catalogue')} />
          )}
          {activeTab === 'assistant' && (
            <DealerAssistant onNavigateToOrders={() => setActiveTab('orders')} />
          )}
          {activeTab === 'forecast' && <ForecastDashboard />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DealerProvider>
      <AppShell />
    </DealerProvider>
  );
}
