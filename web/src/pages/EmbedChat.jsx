import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Typing indicator dots animation via CSS
const typingCSS = `
@keyframes ec-dot-pulse {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}
.ec-typing-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor; display: inline-block;
  animation: ec-dot-pulse 1.4s ease-in-out infinite;
}
.ec-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.ec-typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes ec-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.ec-msg-enter { animation: ec-fade-in 0.2s ease-out; }

/* Markdown content styles */
.ec-md p { margin: 0 0 0.4em 0; }
.ec-md p:last-child { margin-bottom: 0; }
.ec-md pre { background: rgba(0,0,0,0.06); border-radius: 6px; padding: 8px 10px; overflow-x: auto; margin: 4px 0; font-size: 12px; }
.ec-md code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.9em; }
.ec-md :not(pre) > code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; }
.ec-md ul, .ec-md ol { margin: 4px 0; padding-left: 1.4em; }
.ec-md blockquote { margin: 4px 0; padding-left: 10px; border-left: 3px solid rgba(0,0,0,0.15); color: inherit; opacity: 0.8; }
.ec-md table { border-collapse: collapse; margin: 4px 0; font-size: 12px; }
.ec-md th, .ec-md td { border: 1px solid rgba(0,0,0,0.1); padding: 3px 8px; }
.ec-md a { color: inherit; text-decoration: underline; }

/* Dark theme overrides */
.ec-dark .ec-md pre { background: rgba(255,255,255,0.08); }
.ec-dark .ec-md :not(pre) > code { background: rgba(255,255,255,0.1); }
.ec-dark .ec-md blockquote { border-left-color: rgba(255,255,255,0.2); }
.ec-dark .ec-md th, .ec-dark .ec-md td { border-color: rgba(255,255,255,0.12); }

/* Scrollbar */
.ec-messages::-webkit-scrollbar { width: 4px; }
.ec-messages::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 4px; }
.ec-messages::-webkit-scrollbar-track { background: transparent; }

/* Input focus */
.ec-input:focus { border-color: var(--ec-accent, #6366f1) !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }

/* Skills bar */
.ec-skill-chip { transition: all 0.15s; cursor: pointer; user-select: none; }
.ec-skill-chip:hover { opacity: 0.85; }

/* Floating mode */
@keyframes ec-bubble-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes ec-panel-slide { from { opacity: 0; transform: translateY(12px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.ec-bubble { animation: ec-bubble-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.ec-panel-enter { animation: ec-panel-slide 0.25s ease-out; }
.ec-bubble:hover { transform: scale(1.08); }
`;

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0', alignItems: 'center' }}>
      <span className="ec-typing-dot" />
      <span className="ec-typing-dot" />
      <span className="ec-typing-dot" />
    </div>
  );
}

export default function EmbedChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [activeSkills, setActiveSkills] = useState(new Set());
  const [config, setConfig] = useState({
    token: null,
    provider: null,
    model: null,
    theme: 'light',
    accent: '#6366f1',
    title: 'AI Chat',
    placeholder: 'Type a message...',
    welcome: 'Send a message to start chatting',
    systemPrompt: null,
    presets: [], // preset questions for quick start
    skills: [], // skill IDs to show (empty = all enabled)
    mcpServers: [], // MCP server metadata [{name, url}]
    mode: null, // null = inline (default), 'floating' = bubble + panel
    width: 380,
    height: 520,
    position: 'br', // br=bottom-right, bl=bottom-left
  });
  const messagesEndRef = useRef(null);
  const configRef = useRef(config);
  const inputRef = useRef(null);

  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Read initial config from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = {};
    for (const key of ['token', 'provider', 'model', 'theme', 'accent', 'title', 'placeholder', 'welcome', 'systemPrompt', 'mode', 'position']) {
      if (params.get(key)) initial[key] = params.get(key);
    }
    if (params.get('width')) initial.width = parseInt(params.get('width'), 10) || 380;
    if (params.get('height')) initial.height = parseInt(params.get('height'), 10) || 520;
    if (params.get('presets')) initial.presets = params.get('presets').split('|').filter(Boolean);
    if (params.get('skills')) initial.skills = params.get('skills').split(',').filter(Boolean);
    if (Object.keys(initial).length > 0) {
      setConfig(prev => ({ ...prev, ...initial }));
    }
  }, []);

  // Fetch available skills
  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.ok ? r.json() : [])
      .then(skills => setAvailableSkills(skills.filter(s => s.enabled)))
      .catch(() => {});
  }, []);

  // Inject CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = typingCSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const isDark = config.theme === 'dark';

  // Filter skills: if config.skills is set, show only those; otherwise show all enabled
  const visibleSkills = useMemo(() => {
    if (config.skills.length > 0) {
      return availableSkills.filter(s => config.skills.includes(s.id));
    }
    return availableSkills;
  }, [availableSkills, config.skills]);

  const theme = useMemo(() => {
    const accent = config.accent || '#6366f1';
    if (isDark) {
      return {
        bg: '#1a1a2e', card: '#16213e', border: '#2a2a4a',
        text: '#e4e4e7', textSecondary: '#a1a1aa', textMuted: '#71717a',
        inputBg: '#0f0f1f', accent,
        userBubble: accent, userText: '#fff',
        assistantBubble: '#1e1e3a', assistantBorder: '#2a2a4a',
        codeBg: 'rgba(255,255,255,0.05)',
      };
    }
    return {
      bg: '#f8f9fc', card: '#ffffff', border: '#e5e7eb',
      text: '#111827', textSecondary: '#6b7280', textMuted: '#9ca3af',
      inputBg: '#f4f4f8', accent,
      userBubble: accent, userText: '#fff',
      assistantBubble: '#ffffff', assistantBorder: '#e5e7eb',
      codeBg: 'rgba(0,0,0,0.04)',
    };
  }, [isDark, config.accent]);

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || streaming) return;

    // Prepend active skill templates to the user content
    let finalContent = content.trim();
    if (activeSkills.size > 0) {
      const skillPrefixes = visibleSkills
        .filter(s => activeSkills.has(s.id))
        .map(s => s.prompt_template);
      if (skillPrefixes.length > 0) {
        finalContent = skillPrefixes.join('\n') + '\n' + finalContent;
      }
    }

    const userMsg = { role: 'user', content: finalContent };
    // Show original content in the UI (without skill prefixes)
    setMessages(prev => [...prev, { role: 'user', content: content.trim() }]);
    setInput('');
    setStreaming(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const cfg = configRef.current;
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`;

    // Build full message history for multi-turn (use original content for history, skill prefix on current only)
    const allMessages = [...messages.map(m => ({ role: m.role, content: m.content })), { role: userMsg.role, content: finalContent }];

    // Prepend system prompt if configured
    if (cfg.systemPrompt) {
      allMessages.unshift({ role: 'system', content: cfg.systemPrompt });
    }

    try {
      const res = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: cfg.model || 'auto',
          provider: cfg.provider || undefined,
          stream: true,
          messages: allMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        const errorMsg = err.error?.message || 'Request failed';
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${errorMsg}` };
          return updated;
        });
        window.parent.postMessage({ type: 'response', content: `Error: ${errorMsg}`, done: true }, '*');
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.choices?.[0]?.delta?.content || '';
              if (text) {
                fullText += text;
                const captured = fullText;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: captured };
                  return updated;
                });
                window.parent.postMessage({ type: 'response', content: text, done: false }, '*');
              }
            } catch { /* skip invalid JSON */ }
          }
        }
      }

      window.parent.postMessage({ type: 'response', content: '', done: true }, '*');
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message}` };
        return updated;
      });
      window.parent.postMessage({ type: 'response', content: `Error: ${err.message}`, done: true }, '*');
    }

    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [streaming, messages, activeSkills, visibleSkills]);

  // Listen for PostMessage from parent
  useEffect(() => {
    const handler = (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'config') {
        const update = { ...data };
        delete update.type;
        if (update.presets && typeof update.presets === 'string') {
          update.presets = update.presets.split('|').filter(Boolean);
        }
        if (update.skills && typeof update.skills === 'string') {
          update.skills = update.skills.split(',').filter(Boolean);
        }
        if (update.mcpServers && typeof update.mcpServers === 'string') {
          try { update.mcpServers = JSON.parse(update.mcpServers); } catch { update.mcpServers = []; }
        }
        setConfig(prev => ({ ...prev, ...update }));
      }

      if (data.type === 'message' && data.content) {
        sendMessage(data.content);
      }

      if (data.type === 'clear') {
        setMessages([]);
      }

      if (data.type === 'toggle') {
        setPanelOpen(prev => !prev);
      }

      if (data.type === 'open') {
        setPanelOpen(true);
      }

      if (data.type === 'close') {
        setPanelOpen(false);
      }
    };

    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'ready' }, '*');

    return () => window.removeEventListener('message', handler);
  }, [sendMessage]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([]);
    window.parent.postMessage({ type: 'cleared' }, '*');
  };

  const isFloating = config.mode === 'floating';
  const isRight = config.position !== 'bl';

  // Shared chat panel content
  const chatPanel = (
    <div className={isDark ? 'ec-dark' : ''} style={{
      '--ec-accent': theme.accent,
      display: 'flex', flexDirection: 'column',
      height: isFloating ? '100%' : '100vh',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      background: theme.bg, color: theme.text,
      borderRadius: isFloating ? 16 : 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${theme.border}`,
        background: theme.card,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 6px rgba(16,185,129,0.4)',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{config.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: theme.textMuted, fontSize: 11, padding: '2px 6px',
                borderRadius: 4, transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.target.style.color = theme.text}
              onMouseLeave={e => e.target.style.color = theme.textMuted}
              title="Clear chat"
            >
              Clear
            </button>
          )}
          {isFloating && (
            <button
              onClick={() => { setPanelOpen(false); window.parent.postMessage({ type: 'panel-closed' }, '*'); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: theme.textMuted, padding: '2px 4px', borderRadius: 4,
                display: 'flex', alignItems: 'center', transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = theme.text}
              onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: theme.textMuted, fontSize: 13, gap: 8, padding: 20, textAlign: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>{config.welcome}</span>
          {config.presets.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
              justifyContent: 'center', marginTop: 4, maxWidth: '100%',
            }}>
              {config.presets.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="ec-preset"
                  style={{
                    background: 'none',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 20, padding: '5px 12px',
                    fontSize: 12, color: theme.text,
                    cursor: 'pointer', transition: 'all 0.15s',
                    maxWidth: '100%', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.accent; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.text; e.currentTarget.style.background = 'none'; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="ec-messages" style={{
          flex: 1, overflowY: 'auto', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && i === messages.length - 1;
            const isEmpty = !msg.content;

            return (
              <div key={i} className="ec-msg-enter" style={{
                maxWidth: '85%',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isUser ? theme.userBubble : theme.assistantBubble,
                  color: isUser ? theme.userText : theme.text,
                  border: isUser ? 'none' : `1px solid ${theme.assistantBorder}`,
                  fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  {isEmpty && isLastAssistant && streaming ? (
                    <TypingIndicator />
                  ) : isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <div className="ec-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Skills bar */}
      {visibleSkills.length > 0 && (
        <div style={{
          display: 'flex', gap: 4, padding: '6px 12px',
          borderTop: `1px solid ${theme.border}`,
          background: theme.card, flexShrink: 0,
          overflowX: 'auto', alignItems: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          {visibleSkills.map(skill => {
            const isActive = activeSkills.has(skill.id);
            return (
              <button
                key={skill.id}
                className="ec-skill-chip"
                onClick={() => setActiveSkills(prev => {
                  const next = new Set(prev);
                  if (next.has(skill.id)) next.delete(skill.id);
                  else next.add(skill.id);
                  return next;
                })}
                style={{
                  background: isActive ? theme.accent : 'transparent',
                  color: isActive ? '#fff' : theme.textSecondary,
                  border: `1px solid ${isActive ? theme.accent : theme.border}`,
                  borderRadius: 12, padding: '2px 10px',
                  fontSize: 11, fontFamily: 'inherit',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
                title={skill.prompt_template}
              >
                {skill.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        borderTop: `1px solid ${theme.border}`,
        background: theme.card, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          className="ec-input"
          style={{
            flex: 1, border: `1px solid ${theme.border}`, borderRadius: 8,
            padding: '8px 12px', fontSize: 13, outline: 'none',
            background: theme.inputBg, color: theme.text, fontFamily: 'inherit',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={config.placeholder}
          disabled={streaming}
        />
        <button
          type="submit"
          style={{
            background: theme.accent, color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 14px', fontSize: 13,
            cursor: 'pointer', fontWeight: 500, flexShrink: 0,
            opacity: streaming || !input.trim() ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
          disabled={streaming || !input.trim()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );

  // ---- Inline mode (default) ----
  if (!isFloating) {
    return chatPanel;
  }

  // ---- Floating mode ----
  const posStyle = isRight
    ? { right: 20, bottom: 20 }
    : { left: 20, bottom: 20 };

  const panelPosStyle = isRight
    ? { right: 20, bottom: 84 }
    : { left: 20, bottom: 84 };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      pointerEvents: 'none', zIndex: 9999,
    }}>
      {/* Chat panel */}
      {panelOpen && (
        <div className="ec-panel-enter" style={{
          position: 'fixed',
          ...panelPosStyle,
          width: config.width,
          height: config.height,
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          pointerEvents: 'auto',
          zIndex: 10000,
        }}>
          {chatPanel}
        </div>
      )}

      {/* Floating bubble button */}
      <button
        className="ec-bubble"
        onClick={() => {
          const next = !panelOpen;
          setPanelOpen(next);
          window.parent.postMessage({ type: next ? 'panel-opened' : 'panel-closed' }, '*');
          if (next) setTimeout(() => inputRef.current?.focus(), 100);
        }}
        style={{
          position: 'fixed',
          ...posStyle,
          width: 56, height: 56,
          borderRadius: '50%',
          background: theme.accent,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 16px rgba(0,0,0,0.18), 0 0 0 0 ${theme.accent}40`,
          transition: 'transform 0.2s, box-shadow 0.2s',
          pointerEvents: 'auto',
          zIndex: 10001,
        }}
      >
        {panelOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {/* Unread dot when panel is closed and there are messages */}
        {!panelOpen && messages.length > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 14, height: 14, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #fff',
            fontSize: 9, color: '#fff', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {messages.filter(m => m.role === 'assistant').length || ''}
          </div>
        )}
      </button>
    </div>
  );
}
