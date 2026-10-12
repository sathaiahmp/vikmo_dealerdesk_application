import React, { useState } from 'react';
import { useDealer } from '../context/DealerContext';
import { createDealer } from '../api/client';
import {
  Users,
  Plus,
  Building2,
  Phone,
  Mail,
  CreditCard,
  CheckCircle,
  FileText,
  X,
} from 'lucide-react';

export default function DealerPortal() {
  const { dealers, activeDealer, setActiveDealer, refreshDealers, showToast } = useDealer();

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formData, setFormData] = useState({
    dealer_code: '',
    name: '',
    city: '',
    phone: '',
    email: '',
    gstin: '',
    credit_limit: '100000.00',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleCreateDealer = async (e) => {
    e.preventDefault();
    setErrorText('');

    if (!formData.dealer_code.trim() || !formData.name.trim()) {
      setErrorText('Dealer code and business name are required.');
      return;
    }

    try {
      setSubmitting(true);
      await createDealer(formData);
      showToast(`Dealer ${formData.name} (${formData.dealer_code}) created successfully.`, 'success');
      setShowRegisterModal(false);
      setFormData({
        dealer_code: '',
        name: '',
        city: '',
        phone: '',
        email: '',
        gstin: '',
        credit_limit: '100000.00',
      });
      refreshDealers();
    } catch (err) {
      if (err.code === 'DUPLICATE' || err.status === 409) {
        setErrorText(`Dealer code '${formData.dealer_code}' already exists (409 DUPLICATE).`);
      } else {
        setErrorText(err.message || 'Validation error creating dealer.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
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
            Authorized Dealer Directory
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Managing {dealers.length} active spare-parts buyers and wholesale accounts.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
          <Plus size={16} /> Register New Dealer
        </button>
      </div>

      {/* Dealers Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {dealers.map((d) => {
          const isSelected = activeDealer?.id === d.id;
          return (
            <div
              key={d.id}
              className="card-surface"
              style={{
                padding: '1.25rem',
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-hairline)',
                backgroundColor: isSelected ? '#fffdfb' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: 'var(--color-primary)',
                      background: 'var(--color-primary-light)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {d.dealer_code}
                  </span>
                  {isSelected && (
                    <span className="badge badge-optimal">
                      <CheckCircle size={12} /> Active Context
                    </span>
                  )}
                </div>

                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {d.name}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={14} /> {d.city || 'Regional Hub'}
                  </div>
                  {d.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} /> {d.phone}
                    </div>
                  )}
                  {d.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={14} /> {d.email}
                    </div>
                  )}
                  {d.gstin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                      <FileText size={14} /> GSTIN: {d.gstin}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-hairline)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    CREDIT LIMIT
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-secondary)' }}>
                    ₹{parseFloat(d.credit_limit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <button
                  className={`btn ${isSelected ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => setActiveDealer(d)}
                >
                  {isSelected ? 'Active' : 'Select Dealer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Register Dealer Modal */}
      {showRegisterModal && (
        <div className="modal-backdrop" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', fontWeight: 700 }}>
                Register Authorized Dealer
              </h3>
              <button className="btn btn-ghost" onClick={() => setShowRegisterModal(false)}>
                <X size={20} />
              </button>
            </div>

            {errorText && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--status-critical-bg)',
                  border: '1px solid var(--status-critical-border)',
                  color: 'var(--status-critical)',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem',
                }}
              >
                {errorText}
              </div>
            )}

            <form onSubmit={handleCreateDealer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    DEALER CODE * (UNIQUE)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DLR-099"
                    value={formData.dealer_code}
                    onChange={(e) => setFormData({ ...formData, dealer_code: e.target.value.toUpperCase() })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    DEALERSHIP NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Spares"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    CITY
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    PHONE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="dealer@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="33AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  CREDIT LIMIT (INR)
                </label>
                <input
                  type="text"
                  placeholder="100000.00"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => setShowRegisterModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Dealer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
