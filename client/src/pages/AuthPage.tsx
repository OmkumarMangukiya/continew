/*
  AuthPage.tsx — Handles Login and 3-step OTP-verified Registration.
*/

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, Mail, Lock, User, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import './AuthPage.css';

export const AuthPage: React.FC = () => {
  const {
    mode,
    regStep,
    email,
    otp,
    username,
    password,
    confirmPassword,
    isLoading,
    error,
    successMsg,
    cooldown,
    setEmail,
    setOtp,
    setUsername,
    setPassword,
    setConfirmPassword,
    switchMode,
    setRegStep,
    handleSendOtp,
    handleVerifyOtp,
    handleCompleteRegistration,
    handleLogin,
  } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else {
      if (regStep === 1) handleSendOtp();
      else if (regStep === 2) handleVerifyOtp();
      else if (regStep === 3) handleCompleteRegistration();
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-card__header">
          <div className="auth-card__logo-wrap">
            <span className="auth-card__brand">Continew</span>
            <span className="auth-card__badge">v1.0</span>
          </div>
          <p className="auth-card__tagline">
            High-throughput webhook delivery & orchestration engine
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Create Account
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="auth-alert auth-alert--error" role="alert">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="auth-alert auth-alert--success" role="status">
            {successMsg}
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form__group">
              <label htmlFor="login-email">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="developer@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-form__group">
              <label htmlFor="login-password">Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="auth-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Register Multi-Step Form */}
        {mode === 'register' && (
          <div className="auth-register-container">
            {/* Step Wizard Indicator */}
            <div className="auth-wizard">
              <div className={`auth-wizard__step ${regStep >= 1 ? 'auth-wizard__step--active' : ''}`}>
                <span className="auth-wizard__num">1</span>
                <span className="auth-wizard__title">Email</span>
              </div>
              <div className="auth-wizard__line" />
              <div className={`auth-wizard__step ${regStep >= 2 ? 'auth-wizard__step--active' : ''}`}>
                <span className="auth-wizard__num">2</span>
                <span className="auth-wizard__title">Verify</span>
              </div>
              <div className="auth-wizard__line" />
              <div className={`auth-wizard__step ${regStep >= 3 ? 'auth-wizard__step--active' : ''}`}>
                <span className="auth-wizard__num">3</span>
                <span className="auth-wizard__title">Account</span>
              </div>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Step 1: Send OTP */}
              {regStep === 1 && (
                <>
                  <div className="auth-form__group">
                    <label htmlFor="reg-email">Work Email</label>
                    <div className="auth-input-wrapper">
                      <Mail size={16} className="auth-input-icon" />
                      <input
                        id="reg-email"
                        type="email"
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <span className="auth-form__hint">
                      We'll send a 6-digit verification code to confirm your email.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={isLoading || cooldown > 0}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={16} className="auth-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : cooldown > 0 ? (
                      <span>Resend in {cooldown}s</span>
                    ) : (
                      <>
                        <span>Send Verification Code</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Step 2: Verify OTP */}
              {regStep === 2 && (
                <>
                  <div className="auth-form__group">
                    <div className="auth-form__label-row">
                      <label htmlFor="reg-otp">6-Digit Code</label>
                      <button
                        type="button"
                        className="auth-link-btn"
                        onClick={() => setRegStep(1)}
                      >
                        Change ({email})
                      </button>
                    </div>
                    <div className="auth-input-wrapper">
                      <KeyRound size={16} className="auth-input-icon" />
                      <input
                        id="reg-otp"
                        type="text"
                        maxLength={6}
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="auth-otp-input"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="auth-otp-resend">
                      {cooldown > 0 ? (
                        <span className="auth-form__hint">
                          Resend code in {cooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="auth-link-btn"
                          onClick={handleSendOtp}
                          disabled={isLoading}
                        >
                          Resend verification code
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={16} className="auth-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Code</span>
                        <ShieldCheck size={16} />
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Step 3: Username & Password */}
              {regStep === 3 && (
                <>
                  <div className="auth-form__group">
                    <label htmlFor="reg-username">Username</label>
                    <div className="auth-input-wrapper">
                      <User size={16} className="auth-input-icon" />
                      <input
                        id="reg-username"
                        type="text"
                        placeholder="johndoe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="auth-form__group">
                    <label htmlFor="reg-password">Password</label>
                    <div className="auth-input-wrapper">
                      <Lock size={16} className="auth-input-icon" />
                      <input
                        id="reg-password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-form__group">
                    <label htmlFor="reg-confirm-password">Confirm Password</label>
                    <div className="auth-input-wrapper">
                      <Lock size={16} className="auth-input-icon" />
                      <input
                        id="reg-confirm-password"
                        type="password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={16} className="auth-spin" />
                        <span>Completing Setup...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
