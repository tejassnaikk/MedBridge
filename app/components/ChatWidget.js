'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const SUGGESTIONS = [
  'How do I get free medications?',
  'What documents do I need?',
  'What medications can I donate?',
  'How does my clinic join?',
  'How does the waitlist work?',
  'What drugs can\'t be donated?',
];

const WELCOME = {
  role: 'assistant',
  content: "Hi! I'm the MedBridge Assistant. I can help you find free medications, donate unused meds, or join our clinic network. What can I help you with?",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    // Placeholder for streaming bot reply
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated, streaming: true };
          return updated;
        });
      }

      // Mark streaming done
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: accumulated };
        return updated;
      });

      if (!open) setUnread(u => u + 1);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "Sorry, I couldn't reach the server. Please try again in a moment.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 sm:right-6 z-50 flex flex-col shadow-2xl"
          style={{
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(540px, calc(100vh - 120px))',
            background: '#0d1526',
            border: '1px solid #1e2d45',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: '#0a1220', borderBottom: '1px solid #1e2d45' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#00d4aa22', border: '1px solid #00d4aa44' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#00d4aa"/>
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">MedBridge Assistant</p>
                <p className="text-xs mt-0.5" style={{ color: '#00d4aa' }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00d4aa] mr-1 align-middle" />
                  Online
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#64748b] hover:text-white transition-colors p-1 rounded"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2d45 transparent' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 text-sm leading-relaxed"
                  style={{
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.role === 'user' ? '#00d4aa22' : '#111827',
                    border: `1px solid ${msg.role === 'user' ? '#00d4aa44' : '#1e2d45'}`,
                    color: msg.role === 'user' ? '#e2e8f0' : '#cbd5e1',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                  {msg.streaming && !msg.content && (
                    <span className="inline-flex gap-1 items-center h-4">
                      {[0, 1, 2].map(j => (
                        <span
                          key={j}
                          className="w-1.5 h-1.5 rounded-full bg-[#64748b]"
                          style={{ animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Suggestions */}
            {showSuggestions && (
              <div className="pt-1 flex flex-col gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs px-3 py-2 rounded-lg transition-all hover:border-[#00d4aa]/40"
                    style={{
                      background: '#111827',
                      border: '1px solid #1e2d45',
                      color: '#94a3b8',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="shrink-0 px-3 py-3 flex gap-2"
            style={{ borderTop: '1px solid #1e2d45', background: '#0a1220' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={{
                background: '#111827',
                border: '1px solid #1e2d45',
                color: '#e2e8f0',
                maxHeight: '80px',
                lineHeight: '1.4',
              }}
              onFocus={e => { e.target.style.borderColor = '#00d4aa44'; }}
              onBlur={e => { e.target.style.borderColor = '#1e2d45'; }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: input.trim() && !loading ? '#00d4aa' : '#1e2d45',
                color: input.trim() && !loading ? '#0a0e1a' : '#64748b',
                alignSelf: 'flex-end',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
        style={{ background: open ? '#1e2d45' : '#00d4aa', color: open ? '#64748b' : '#0a0e1a' }}
        aria-label="Open MedBridge chat"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        )}
        {!open && unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
            style={{ background: '#ef4444' }}
          >
            {unread}
          </span>
        )}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
