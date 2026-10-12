import React from 'react';
import { useDealer } from '../context/DealerContext';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Users,
  ShoppingCart,
  BotMessageSquare,
  TrendingUp,
  Store,
  ChevronDown,
} from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab }) {
  const { dealers, activeDealer, setActiveDealer, cart } = useDealer();

  const navItems = [
    { id: 'overview', label: 'Operations Overview', icon: LayoutDashboard },
    { id: 'catalogue', label: 'Product Catalogue', icon: Boxes },
    { id: 'inventory', label: 'Inventory Audit', icon: ClipboardList },
    { id: 'dealers', label: 'Dealer Directory', icon: Users },
    { id: 'orders', label: 'Orders & Checkout', icon: ShoppingCart, badge: cart.length },
    { id: 'assistant', label: 'AI Dealer Assistant', icon: BotMessageSquare },
    { id: 'forecast', label: 'Demand Forecast & ML', icon: TrendingUp },
  ];

  return (
    <>
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'var(--color-primary)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontFamily: 'var(--font-headline)',
              }}
            >
              VK
            </div>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                }}
              >
                VIKMO
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                DealerDesk Operations
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: '1rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Icon size={18} color={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'} />
                  <span>{item.label}</span>
                </div>
                {item.badge > 0 && (
                  <span
                    style={{
                      background: isActive ? '#ffffff' : 'var(--color-primary)',
                      color: isActive ? 'var(--color-primary)' : '#ffffff',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-optimal)',
              }}
            />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
              Neon PostgreSQL Connected
            </span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
            Gemini 3.8 Flash • AI/ML Track
          </p>
        </div>
      </aside>
    </>
  );
}
