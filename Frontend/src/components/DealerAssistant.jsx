import React, { useState, useRef, useEffect } from 'react';
import { useDealer } from '../context/DealerContext';
import { sendAssistantMessage } from '../api/client';
import {
  BotMessageSquare,
  Send,
  User,
  Wrench,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';

export default function DealerAssistant({ onNavigateToOrders }) {
  const { activeDealer, addToCart, showToast } = useDealer();

  const [sessionId, setSessionId] = useState(() => {
    return 'sess_' + Math.random().toString(36).substring(2, 10);
  });
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I am your AI Dealer Assistant powered by Groq (Llama-70B). I can search our 600 spare parts catalogue, check real-time PostgreSQL stock levels and prices, and draft purchase orders on your behalf. How can I assist your dealership today?",
      tool_calls: [],
      cited_skus: [],
      actions: [],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text || loading) return;

    if (!activeDealer) {
      showToast('Please select an active dealer before chatting.', 'error');
      return;
    }

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    try {
      const res = await sendAssistantMessage(sessionId, activeDealer.id, text);
      const assistantMsg = {
        role: 'assistant',
        content: res.reply || 'Request completed.',
        tool_calls: res.tool_calls || [],
        cited_skus: res.cited_skus || [],
        actions: res.actions || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = {
        role: 'assistant',
        content: `Error: ${err.message || 'The assistant encountered an error. Please try again.'}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setElapsedSec(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const startNewSession = () => {
    const newId = 'sess_' + Math.random().toString(36).substring(2, 10);
    setSessionId(newId);
    setMessages([
      {
        role: 'assistant',
        content:
          "Started a fresh conversation session. You can ask me to search parts, check inventory quantities, or prepare draft orders.",
        tool_calls: [],
        cited_skus: [],
        actions: [],
      },
    ]);
    showToast('New assistant conversation started.', 'info');
  };

  const samplePrompts = [
    'Do you have front brake pads for Pulsar 150?',
    'Check live stock and prices for BRK-1044',
    'Create a draft order for 3 units of BRK-1044',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 128px)', gap: '1rem' }}>
      {/* Assistant Header */}
      <div
        className="card-surface"
        style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--color-primary-light)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <BotMessageSquare size={24} color="var(--color-primary)" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.25rem', fontWeight: 700 }}>
              AI Dealer Assistant
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
              Provider: Groq (Llama-70B Tool-Use) • Session ID: {sessionId}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={startNewSession}>
            <RefreshCw size={14} /> New Chat
          </button>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div
        className="card-surface"
        style={{
          flex: 1,
          padding: '1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: '#ffffff',
        }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '0.85rem',
                alignItems: 'flex-start',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  <BotMessageSquare size={16} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                {/* Message Bubble */}
                <div
                  style={{
                    padding: '0.85rem 1.15rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isUser ? 'var(--color-primary)' : 'var(--surface-panel)',
                    color: isUser ? '#ffffff' : 'var(--text-main)',
                    border: isUser ? 'none' : '1px solid var(--border-hairline)',
                    lineHeight: 1.6,
                    fontSize: '0.9rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>

                {/* Tool Call Badges (if any) */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {msg.tool_calls.map((tc, tIdx) => (
                      <span
                        key={tIdx}
                        className="badge badge-transit"
                        style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      >
                        <Wrench size={12} /> Tool Executed: {tc.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Cited SKUs (Clickable) */}
                {msg.cited_skus && msg.cited_skus.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      CITED SKUS:
                    </span>
                    {msg.cited_skus.map((sku) => (
                      <button
                        key={sku}
                        className="badge badge-optimal"
                        style={{ cursor: 'pointer', border: '1px solid var(--status-optimal-border)' }}
                        onClick={() => addToCart({ sku, name: sku, price: '0.00' }, 1)}
                        title="Click to add to draft cart"
                      >
                        + Add {sku} to Cart
                      </button>
                    ))}
                  </div>
                )}

                {/* Side Effects / Draft Orders Created */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {msg.actions.map((act, aIdx) => (
                      <div
                        key={aIdx}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: 'var(--status-optimal-bg)',
                          border: '1px solid var(--status-optimal-border)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={16} color="var(--status-optimal)" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Draft Purchase Order Created: <code>{act.order_number}</code>
                          </span>
                        </div>
                        {onNavigateToOrders && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => onNavigateToOrders()}
                          >
                            View Order <ExternalLink size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  <User size={16} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--text-muted)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <BotMessageSquare size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span className="animate-pulse-subtle" style={{ fontSize: '0.85rem' }}>
                Querying live database &amp; reasoning with AI ({elapsedSec}s)...
              </span>
              {elapsedSec >= 10 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Tool-calling loop active — may take up to 30s on complex queries
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Pill Row */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {samplePrompts.map((prompt, pIdx) => (
          <button
            key={pIdx}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '15px' }}
            onClick={() => {
              setInputValue(prompt);
            }}
          >
            <Sparkles size={12} color="var(--color-primary)" /> {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSendMessage}
        style={{
          display: 'flex',
          gap: '0.75rem',
        }}
      >
        <input
          type="text"
          placeholder="Ask the assistant to search parts, check real-time stock, or draft an order..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
          className="input-field"
          style={{ fontSize: '0.95rem', padding: '0.75rem 1rem' }}
        />
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="btn btn-primary"
          style={{ padding: '0 1.5rem' }}
        >
          <Send size={16} /> Send
        </button>
      </form>
    </div>
  );
}
