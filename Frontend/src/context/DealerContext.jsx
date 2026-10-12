import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDealers } from '../api/client';

const DealerContext = createContext(null);

export function DealerProvider({ children }) {
  const [dealers, setDealers] = useState([]);
  const [activeDealer, setActiveDealer] = useState(null);
  const [cart, setCart] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(true);
  const [toast, setToast] = useState(null);

  // Show auto-dismiss toast
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadDealers = async () => {
    try {
      setLoadingDealers(true);
      const res = await getDealers(1, 100);
      const list = res.results || [];
      setDealers(list);
      if (list.length > 0 && !activeDealer) {
        // Restore from localStorage or default to first
        const savedId = localStorage.getItem('vikmo_active_dealer_id');
        const found = list.find((d) => String(d.id) === savedId);
        setActiveDealer(found || list[0]);
      }
    } catch (err) {
      console.error('Failed to load dealers:', err);
      showToast('Failed to connect to backend dealers.', 'error');
    } finally {
      setLoadingDealers(false);
    }
  };

  useEffect(() => {
    loadDealers();
  }, []);

  const handleSelectDealer = (dealer) => {
    setActiveDealer(dealer);
    if (dealer) {
      localStorage.setItem('vikmo_active_dealer_id', String(dealer.id));
      showToast(`Active dealer switched to ${dealer.name} (${dealer.dealer_code})`, 'success');
    }
  };

  // Cart Management
  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.sku === product.sku);
      if (existing) {
        return prev.map((item) =>
          item.sku === product.sku
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          unit_price: product.price || product.unit_price,
          quantity,
        },
      ];
    });
    showToast(`Added ${quantity}x ${product.sku} to Draft Cart`, 'success');
  };

  const removeFromCart = (sku) => {
    setCart((prev) => prev.filter((item) => item.sku !== sku));
    showToast(`Removed ${sku} from cart`, 'info');
  };

  const updateCartQuantity = (sku, quantity) => {
    if (quantity <= 0) {
      removeFromCart(sku);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.sku === sku ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  // Compute Cart Totals
  const subtotal = cart.reduce((sum, item) => {
    const price = parseFloat(item.unit_price) || 0;
    return sum + price * item.quantity;
  }, 0);
  const taxTotal = subtotal * 0.18; // 18% GST standard
  const grandTotal = subtotal + taxTotal;

  return (
    <DealerContext.Provider
      value={{
        dealers,
        activeDealer,
        setActiveDealer: handleSelectDealer,
        refreshDealers: loadDealers,
        loadingDealers,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotals: {
          subtotal: subtotal.toFixed(2),
          taxTotal: taxTotal.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
        },
        toast,
        showToast,
      }}
    >
      {children}
    </DealerContext.Provider>
  );
}

export function useDealer() {
  const context = useContext(DealerContext);
  if (!context) {
    throw new Error('useDealer must be used within a DealerProvider');
  }
  return context;
}
