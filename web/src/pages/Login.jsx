import { useState } from 'react';
import { Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function Login({ onLogin, hasUsers }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isSetup = !hasUsers;

  const handleSubmit = async () => {
    if (!username || !password) return message.error('Please enter username and password');
    if (isSetup) {
      if (password.length < 6) return message.error('Password must be at least 6 characters');
      if (password !== confirmPassword) return message.error('Passwords do not match');
    }

    setLoading(true);
    try {
      const result = isSetup
        ? await api.setupAdmin(username, password)
        : await api.login(username, password);

      if (result.error) {
        message.error(result.error);
      } else {
        onLogin(result.user);
      }
    } catch {
      message.error('Connection failed');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div className="animate-fade-in" style={{
        width: 380,
        padding: 36,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
          }}>
            AI
          </div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>
            {isSetup ? 'Create Admin Account' : 'Sign In'}
          </h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            {isSetup ? 'Set up your first admin account to get started' : 'Local AI Proxy'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            size="large"
            prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Input.Password
            size="large"
            prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isSetup && (
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          )}
          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
            style={{ marginTop: 4 }}
          >
            {isSetup ? 'Create Account' : 'Sign In'}
          </Button>
        </div>
      </div>
    </div>
  );
}
