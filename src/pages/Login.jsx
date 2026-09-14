import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppContext';

/* ─── 60/30/10 Colour Rule ────────────────────────────────────────────
   60 % → #0D0F1C  deep midnight navy   (dominant background)
   30 % → #161929  rich slate-charcoal  (surfaces / panels)
   10 % → #F59E0B  amber-gold           (CTAs, highlights, accents)
──────────────────────────────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  /* ── Dark mode tokens (default) ── */
  .login-root {
    --lr-bg:           #0D0F1C;
    --lr-panel:        #161929;
    --lr-dot:          rgba(255,255,255,0.04);
    --lr-text:         #FAFAFA;
    --lr-text-sub:     rgba(250,250,250,0.45);
    --lr-text-muted:   rgba(255,255,255,0.38);
    --lr-label:        rgba(255,255,255,0.6);
    --lr-input-bg:     rgba(255,255,255,0.04);
    --lr-input-bd:     rgba(255,255,255,0.08);
    --lr-input-text:   #FAFAFA;
    --lr-placeholder:  rgba(255,255,255,0.2);
    --lr-icon:         rgba(255,255,255,0.25);
    --lr-eye:          rgba(255,255,255,0.3);
    --lr-eye-h:        rgba(255,255,255,0.7);
    --lr-divider:      rgba(255,255,255,0.07);
    --lr-footer-bd:    rgba(255,255,255,0.06);
    --lr-security:     rgba(255,255,255,0.25);
    --lr-copyright:    rgba(255,255,255,0.15);
    --lr-pill-bg:      rgba(255,255,255,0.07);
    --lr-pill-bd:      rgba(255,255,255,0.12);
    --lr-pill-text:    rgba(255,255,255,0.8);
  }

  /* ── Light mode tokens ── */
  .login-root.login-light {
    --lr-bg:           #EAE7F5;
    --lr-panel:        #F2F0FA;
    --lr-dot:          rgba(45,37,80,0.04);
    --lr-text:         #1E1535;
    --lr-text-sub:     rgba(45,37,80,0.55);
    --lr-text-muted:   rgba(45,37,80,0.5);
    --lr-label:        rgba(45,37,80,0.65);
    --lr-input-bg:     rgba(255,255,255,0.75);
    --lr-input-bd:     rgba(45,37,80,0.15);
    --lr-input-text:   #1E1535;
    --lr-placeholder:  rgba(45,37,80,0.3);
    --lr-icon:         rgba(45,37,80,0.3);
    --lr-eye:          rgba(45,37,80,0.35);
    --lr-eye-h:        rgba(45,37,80,0.7);
    --lr-divider:      rgba(45,37,80,0.1);
    --lr-footer-bd:    rgba(45,37,80,0.1);
    --lr-security:     rgba(45,37,80,0.4);
    --lr-copyright:    rgba(45,37,80,0.3);
    --lr-pill-bg:      rgba(45,37,80,0.07);
    --lr-pill-bd:      rgba(45,37,80,0.15);
    --lr-pill-text:    rgba(45,37,80,0.8);
  }

  .login-root {
    min-height: 100vh;
    display: flex;
    background: var(--lr-bg);
    font-family: 'Inter', system-ui, sans-serif;
    overflow: hidden;
    position: relative;
    transition: background 0.35s ease;
  }

  /* ── Left branding panel (60%) ───────────────────── */
  .login-brand {
    display: none;
    position: relative;
    overflow: hidden;
    background: var(--lr-bg);
    transition: background 0.35s ease;
  }
  @media (min-width: 1024px) {
    .login-brand { display: flex; flex-direction: column; justify-content: center; width: 58%; }
  }

  /* Animated mesh gradient */
  .login-brand::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 60% at 80% 10%, rgba(245,158,11,0.09) 0%, transparent 65%),
      radial-gradient(ellipse 50% 50% at 20% 80%, rgba(20,184,166,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 40% 40% at 55% 50%, rgba(245,158,11,0.04) 0%, transparent 55%);
    pointer-events: none;
  }

  /* Subtle dot grid */
  .login-brand::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, var(--lr-dot) 1px, transparent 1px);
    background-size: 36px 36px;
    pointer-events: none;
  }

  .brand-content {
    position: relative;
    z-index: 10;
    padding: 3rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  /* Logo badge */
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .brand-logo-img {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    object-fit: contain;
    box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 8px 32px rgba(245,158,11,0.25);
  }
  .brand-logo-name {
    color: var(--lr-text);
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  /* Hero headline */
  .brand-headline {
    max-width: 480px;
  }
  .brand-headline h2 {
    font-size: clamp(2.2rem, 3.5vw, 3.4rem);
    font-weight: 900;
    line-height: 1.08;
    letter-spacing: -0.04em;
    color: var(--lr-text);
    margin: 0 0 1.25rem;
  }
  .brand-headline h2 .accent {
    background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #14B8A6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .brand-headline p {
    font-size: 1rem;
    line-height: 1.75;
    color: var(--lr-text-sub);
    margin: 0;
    max-width: 400px;
  }

  /* feature-pills removed */

  /* Floating stat card */
  .stat-card {
    position: absolute;
    bottom: 3rem;
    right: -1.5rem;
    background: rgba(22,25,41,0.85);
    border: 1px solid rgba(245,158,11,0.18);
    border-radius: 18px;
    padding: 1rem 1.25rem;
    backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    gap: 0.875rem;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    animation: float 6s ease-in-out infinite;
  }
  .stat-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 0 3px rgba(16,185,129,0.25);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes float {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-8px); }
  }
  @keyframes pulse-dot {
    0%,100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.25); }
    50%      { box-shadow: 0 0 0 6px rgba(16,185,129,0.12); }
  }
  .stat-card-text strong { display: block; font-size: 0.8rem; font-weight: 700; color: #FAFAFA; }
  .stat-card-text span   { font-size: 0.72rem; color: rgba(255,255,255,0.4); }

  /* ── Right form panel (30%) ──────────────────────── */
  .login-form-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--lr-panel);
    position: relative;
    overflow: hidden;
    padding: 2rem 1.5rem;
    transition: background 0.35s ease;
  }
  .login-form-panel::before {
    content: '';
    position: absolute;
    top: -30%;
    right: -20%;
    width: 500px; height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 65%);
    pointer-events: none;
  }
  .login-form-panel::after {
    content: '';
    position: absolute;
    bottom: -25%;
    left: -15%;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 65%);
    pointer-events: none;
  }

  .login-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 420px;
  }

  /* Mobile logo */
  .mobile-logo {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 2rem;
  }
  @media (min-width: 1024px) { .mobile-logo { display: none; } }
  .mobile-logo img {
    width: 36px; height: 36px; border-radius: 10px; object-fit: contain;
    box-shadow: 0 0 0 1px rgba(245,158,11,0.25), 0 6px 20px rgba(245,158,11,0.2);
  }
  .mobile-logo span { font-size: 0.95rem; font-weight: 700; color: var(--lr-text); letter-spacing: -0.02em; }

  /* Card header */
  .form-header { margin-bottom: 2rem; }
  .form-header .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.2);
    border-radius: 100px;
    padding: 0.3rem 0.875rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #F59E0B;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .form-header h1 {
    font-size: 1.875rem;
    font-weight: 800;
    color: var(--lr-text);
    letter-spacing: -0.04em;
    margin: 0 0 0.5rem;
    line-height: 1.15;
  }
  .form-header p {
    font-size: 0.875rem;
    color: var(--lr-text-muted);
    margin: 0;
    line-height: 1.6;
  }

  /* Input groups */
  .input-group { margin-bottom: 1.125rem; }
  .input-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .input-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--lr-label);
    letter-spacing: 0.01em;
  }
  .forgot-link {
    font-size: 0.75rem;
    font-weight: 600;
    color: #F59E0B;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
    text-decoration: none;
  }
  .forgot-link:hover { color: #FBBF24; }

  .input-wrap {
    position: relative;
  }
  .input-icon {
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: var(--lr-icon);
    transition: color 0.2s;
    line-height: 1;
  }
  .input-wrap.focused .input-icon { color: #F59E0B; }

  .form-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.875rem 1rem 0.875rem 2.875rem;
    background: var(--lr-input-bg);
    border: 1px solid var(--lr-input-bd);
    border-radius: 14px;
    color: var(--lr-input-text);
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .form-input::placeholder { color: var(--lr-placeholder); }
  .form-input:focus {
    border-color: rgba(245,158,11,0.5);
    background: rgba(245,158,11,0.04);
    box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
  }
  .input-toggle {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--lr-eye);
    transition: color 0.2s;
    line-height: 1;
  }
  .input-toggle:hover { color: var(--lr-eye-h); }

  /* Error alert */
  .error-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 12px;
    padding: 0.875rem 1rem;
    margin-bottom: 1.125rem;
    color: #FCA5A5;
    font-size: 0.825rem;
    font-weight: 500;
  }

  /* Submit button (10% accent) */
  .submit-btn {
    width: 100%;
    padding: 0.9375rem;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #F59E0B 100%);
    background-size: 200% 200%;
    color: #0D0F1C;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    box-shadow: 0 8px 28px rgba(245,158,11,0.3);
    transition: transform 0.2s, box-shadow 0.2s, background-position 0.4s;
  }
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 14px 40px rgba(245,158,11,0.45);
    background-position: 100% 50%;
  }
  .submit-btn:active:not(:disabled) { transform: translateY(0); }
  .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  /* Divider */
  .form-divider {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin: 1.5rem 0;
  }
  .form-divider::before, .form-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.07);
  }
  .form-divider span { font-size: 0.72rem; color: rgba(255,255,255,0.25); white-space: nowrap; }

  /* Footer */
  .form-footer {
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--lr-footer-bd);
    text-align: center;
  }
  .security-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--lr-security);
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 0.625rem;
  }
  .security-note svg { color: #14B8A6; }
  .copyright {
    font-size: 0.7rem;
    color: var(--lr-copyright);
  }

  /* Splash */
  .splash-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--lr-bg, #0D0F1C);
  }
  .splash-inner { text-align: center; }
  .splash-logo {
    width: 72px; height: 72px;
    border-radius: 20px;
    object-fit: contain;
    margin: 0 auto 1.25rem;
    box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 12px 40px rgba(245,158,11,0.35);
    animation: splash-pulse 1.5s ease-in-out infinite;
  }
  @keyframes splash-pulse {
    0%,100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 12px 40px rgba(245,158,11,0.35); }
    50%      { box-shadow: 0 0 0 1px rgba(245,158,11,0.5), 0 16px 60px rgba(245,158,11,0.55); }
  }
  .splash-title { color: #FAFAFA; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.375rem; }
  .splash-sub   { color: rgba(245,158,11,0.6); font-size: 0.8rem; margin-bottom: 1.5rem; }
  .splash-spinner {
    width: 32px; height: 32px;
    border: 2px solid rgba(245,158,11,0.15);
    border-top-color: #F59E0B;
    border-radius: 50%;
    margin: 0 auto;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Mount animations */
  .mount-fade { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
  .mount-fade.visible { opacity: 1; transform: translateY(0); }
  .delay-100 { transition-delay: 0.10s; }
  .delay-200 { transition-delay: 0.20s; }
  .delay-300 { transition-delay: 0.30s; }
  .delay-400 { transition-delay: 0.40s; }
  .delay-500 { transition-delay: 0.50s; }

  /* Theme toggle pill */
  .theme-toggle {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--lr-pill-bg);
    border: 1px solid var(--lr-pill-bd);
    border-radius: 100px;
    padding: 0.375rem 0.875rem 0.375rem 0.625rem;
    cursor: pointer;
    backdrop-filter: blur(12px);
    transition: background 0.2s, border-color 0.2s, transform 0.15s, color 0.2s;
    color: var(--lr-pill-text);
    font-size: 0.75rem;
    font-weight: 600;
    font-family: 'Inter', system-ui, sans-serif;
    letter-spacing: 0.01em;
  }
  .theme-toggle:hover {
    background: rgba(245,158,11,0.12);
    border-color: rgba(245,158,11,0.4);
    color: var(--lr-text);
    transform: translateY(-1px);
  }
  .theme-toggle .toggle-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245,158,11,0.15);
    color: #F59E0B;
    transition: background 0.2s, color 0.2s;
    flex-shrink: 0;
  }
  .theme-toggle:hover .toggle-icon {
    background: rgba(245,158,11,0.25);
  }
`;

export default function Login() {
  const [email, setEmail]               = useState('admin@lostandfound.edu');
  const [password, setPassword]         = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showSplash, setShowSplash]     = useState(false);
  const { login }                       = useAuth();
  const { settings, toggleDarkMode }    = useAppSettings();
  const isDark                          = settings.darkMode;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowSplash(true);
    const result = await login(email, password);
    if (!result.success) {
      setLoading(false);
      setShowSplash(false);
      setError(result.error);
    }
  };

  const cls = (...c) => c.filter(Boolean).join(' ');

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Splash overlay ── */}
      {showSplash && (
        <div className="splash-overlay">
          <div className="splash-inner">
            <img src="/logo.png" alt="Lost & Found" className="splash-logo" />
            <p className="splash-title">Lost & Found</p>
            <p className="splash-sub">Authenticating…</p>
            <div className="splash-spinner" />
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className={`login-root${!isDark ? ' login-light' : ''}`} style={{ display: showSplash ? 'none' : undefined }}>

        {/* ── Dark / Light toggle (top-right) ── */}
        <button
          type="button"
          onClick={toggleDarkMode}
          className="theme-toggle"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="toggle-icon">
            {isDark ? (
              /* Sun icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </span>
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>

        {/* ══ LEFT BRAND PANEL (60%) ══ */}
        <div className="login-brand">
          <div className="brand-content">

            {/* Logo */}
            <div className={cls('brand-logo mount-fade delay-100', mounted && 'visible')}>
              <img src="/logo.png" alt="Lost & Found" className="brand-logo-img" />
              <span className="brand-logo-name">Lost & Found</span>
            </div>

            {/* Headline */}
            <div className={cls('brand-headline mount-fade delay-200', mounted && 'visible')}>
              <h2>
                Reunite people<br />
                with what{' '}
                <span className="accent">matters most.</span>
              </h2>
              <p>
                Manage lost & found items, match owners with their belongings,
                and keep your campus organised — all from one powerful dashboard.
              </p>
            </div>


          </div>


        </div>

        {/* ══ RIGHT FORM PANEL (30%) ══ */}
        <div className="login-form-panel">
          <div className="login-card">

            {/* Mobile logo */}
            <div className="mobile-logo">
              <img src="/logo.png" alt="Lost & Found" />
              <span>Lost & Found</span>
            </div>

            {/* Header */}
            <div className={cls('form-header mount-fade delay-100', mounted && 'visible')}>
              <div className="eyebrow">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Admin Portal
              </div>
              <h1>Welcome back</h1>
              <p>Sign in to your admin account to continue.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className={cls('mount-fade delay-200', mounted && 'visible')}>

              {/* Error */}
              {error && (
                <div className="error-alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="input-group">
                <div className="input-label-row">
                  <label htmlFor="login-email" className="input-label">Email Address</label>
                </div>
                <div className={cls('input-wrap', focusedField === 'email' && 'focused')}>
                  <div className="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="form-input"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="input-group">
                <div className="input-label-row">
                  <label htmlFor="login-password" className="input-label">Password</label>
                  <button type="button" className="forgot-link">Forgot password?</button>
                </div>
                <div className={cls('input-wrap', focusedField === 'password' && 'focused')}>
                  <div className="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="form-input"
                    placeholder="••••••••"
                    style={{ paddingRight: '3rem' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="input-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit (10% accent — amber CTA) */}
              <button
                type="submit"
                disabled={loading}
                id="login-submit-btn"
                className="submit-btn"
              >
                {loading ? (
                  <>
                    <div className="splash-spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className={cls('form-footer mount-fade delay-300', mounted && 'visible')}>
              <div className="security-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Protected by end-to-end encryption
              </div>
              <p className="copyright">© 2026 Lost & Found System</p>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
