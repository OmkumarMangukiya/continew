/*
  useAuth.ts — Hook managing authentication state machine:
  - Login
  - 3-step Registration: Email OTP -> Verify OTP -> Set Password & Username
  - Cooldown timer for OTP resend
*/

import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuthContext } from '../context/useAuthContext';

export type AuthMode = 'login' | 'register';
export type RegisterStep = 1 | 2 | 3;

export function useAuth() {
  const { login, register } = useAuthContext();

  const [mode, setMode] = useState<AuthMode>('login');
  const [regStep, setRegStep] = useState<RegisterStep>(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cooldown timer (in seconds)
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cooldown]);

  const clearFeedback = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    clearFeedback();
    if (newMode === 'login') {
      setRegStep(1);
    }
  };

  // 1. Send OTP
  const handleSendOtp = async () => {
    clearFeedback();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    setIsLoading(true);
    const res = await api.auth.sendOtp(email.trim());
    setIsLoading(false);

    if (!res.ok) {
      setError(res.error || 'Failed to send OTP');
      // If rate limited, try extracting seconds
      if (res.statusCode === 429 && res.error) {
        const match = res.error.match(/\d+/);
        if (match) {
          setCooldown(parseInt(match[0], 10));
        }
      }
      return false;
    }

    setSuccessMsg(res.data?.message || 'Verification code sent to your email.');
    setCooldown(60);
    setRegStep(2);
    return true;
  };

  // 2. Verify OTP
  const handleVerifyOtp = async () => {
    clearFeedback();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit code received in your email');
      return false;
    }

    setIsLoading(true);
    const res = await api.auth.verifyOtp(email.trim(), otp.trim());
    setIsLoading(false);

    if (!res.ok) {
      setError(res.error || 'Invalid or expired OTP');
      return false;
    }

    setSuccessMsg('Email verified. Now choose a username and password.');
    setRegStep(3);
    return true;
  };

  // 3. Complete Registration
  const handleCompleteRegistration = async () => {
    clearFeedback();
    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    setIsLoading(true);
    const res = await register(email.trim(), password, username.trim());
    setIsLoading(false);

    if (!res.ok) {
      setError(res.error || 'Registration failed');
      return false;
    }

    return true;
  };

  // Login handler
  const handleLogin = async () => {
    clearFeedback();
    if (!email.trim()) {
      setError('Please enter your email');
      return false;
    }

    if (!password) {
      setError('Please enter your password');
      return false;
    }

    setIsLoading(true);
    const res = await login(email.trim(), password);
    setIsLoading(false);

    if (!res.ok) {
      setError(res.error || 'Invalid credentials');
      return false;
    }

    return true;
  };

  return {
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
  };
}
