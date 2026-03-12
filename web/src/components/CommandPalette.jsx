import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  ApiOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  CloudServerOutlined,
  SettingOutlined,
  BulbOutlined,
  SearchOutlined,
  MessageOutlined,
} from '@ant-design/icons';

const commands = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: <DashboardOutlined />, path: '/', keywords: 'home overview stats' },
  { id: 'chat', label: 'Go to Chat', icon: <MessageOutlined />, path: '/chat', keywords: 'conversation message talk ai' },
  { id: 'providers', label: 'Go to Providers', icon: <ApiOutlined />, path: '/providers', keywords: 'api connection model' },
  { id: 'logs', label: 'Go to Logs', icon: <FileTextOutlined />, path: '/logs', keywords: 'request response debug' },
  { id: 'apps', label: 'Go to Apps', icon: <AppstoreOutlined />, path: '/apps', keywords: 'links bookmarks cors' },
  { id: 'docker', label: 'Go to Docker', icon: <CloudServerOutlined />, path: '/docker', keywords: 'sandbox container' },
  { id: 'settings', label: 'Go to Settings', icon: <SettingOutlined />, path: '/settings', keywords: 'config port logging' },
  { id: 'theme', label: 'Toggle Theme', icon: <BulbOutlined />, action: 'toggle-theme', keywords: 'dark light mode' },
];

export default function CommandPalette({ onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const filtered = commands.filter(cmd => {
    if (!query) return true;
    const q = query.toLowerCase();
    return cmd.label.toLowerCase().includes(q) || cmd.keywords.includes(q);
  });

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeCommand = useCallback((cmd) => {
    setOpen(false);
    if (cmd.path) {
      navigate(cmd.path);
    } else if (cmd.action === 'toggle-theme') {
      onToggleTheme?.();
    }
  }, [navigate, onToggleTheme]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      executeCommand(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
        }}
        onClick={() => setOpen(false)}
      />
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 520,
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1001,
        overflow: 'hidden',
        animation: 'slideUp 0.15s ease',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <SearchOutlined style={{ color: 'var(--text-tertiary)', fontSize: 16 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              background: 'transparent',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <span className="kbd" style={{ fontSize: 10, padding: '2px 5px' }}>ESC</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                onClick={() => executeCommand(cmd)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: i === selectedIndex ? 'var(--color-primary-bg)' : 'transparent',
                  color: i === selectedIndex ? 'var(--color-primary)' : 'var(--text-primary)',
                  transition: 'all 0.1s ease',
                  fontSize: 14,
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span style={{ fontSize: 15, opacity: 0.7 }}>{cmd.icon}</span>
                <span style={{ flex: 1, fontWeight: 500 }}>{cmd.label}</span>
                {cmd.path && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {cmd.path}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: 16,
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}>
          <span><span className="kbd" style={{ fontSize: 9, padding: '1px 4px', marginRight: 4 }}>Enter</span> Select</span>
          <span><span className="kbd" style={{ fontSize: 9, padding: '1px 4px', marginRight: 4 }}>Up/Down</span> Navigate</span>
          <span><span className="kbd" style={{ fontSize: 9, padding: '1px 4px', marginRight: 4 }}>Ctrl+K</span> Toggle</span>
        </div>
      </div>
    </>
  );
}
