import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPhoneNumber, RecaptchaVerifier, signInWithPopup } from 'firebase/auth';
import { auth, isFirebaseConfigured, googleProvider } from '../firebase';
import { Lock, Mail, Loader2, Leaf, Phone, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ADMIN_EMAIL } from '../constants';

interface LoginProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function Login({ showToast }: LoginProps) {
  const navigate = useNavigate();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'login' | 'mfa' | 'otp'>('login');
  const [securityPin, setSecurityPin] = useState('');

  // For Demo/Pseudo-MFA
  const CORRECT_PIN = "2026"; 

  useEffect(() => {
    if (isFirebaseConfigured && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          console.log("Recaptcha verified");
        }
      });
    }
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isFirebaseConfigured) {
        await signInWithEmailAndPassword(auth, email, password);
        window.dispatchEvent(new Event('user-login'));
        navigate('/');
      } else {
        // Demo Mode
        if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === 'admin123') {
          localStorage.setItem('demo_user', JSON.stringify({ email: ADMIN_EMAIL, role: 'admin', name: 'Admin' }));
          window.dispatchEvent(new Event('user-login'));
          navigate('/admin');
        } else {
          localStorage.setItem('demo_user', JSON.stringify({ email, role: 'user', name: email.split('@')[0] }));
          window.dispatchEvent(new Event('user-login'));
          navigate('/');
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("This login method is not enabled in your Firebase Console. Please enable 'Email/Password' and 'Phone' in Authentication settings.");
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!isFirebaseConfigured) {
        throw new Error("Phone login requires Firebase configuration.");
      }
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setVerificationId(confirmationResult);
      setStep('otp');
      setMessage("OTP sent to your mobile number.");
    } catch (err: any) {
      console.error("Phone login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Phone login is not enabled in your Firebase Console. Please enable 'Phone' in Authentication settings.");
      } else if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/captcha-check-failed') {
        setError(`Domain not authorized. Please add "${window.location.hostname}" to your Firebase Console > Authentication > Settings > Authorized domains.`);
      } else {
        setError(err.message || "Failed to send OTP.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verificationId.confirm(otp);
      setStep('mfa');
    } catch (err: any) {
      setError("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityPin === CORRECT_PIN) {
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        localStorage.setItem('demo_user', JSON.stringify({ email: ADMIN_EMAIL, role: 'admin', name: 'Admin' }));
      }
      window.dispatchEvent(new Event('user-login'));
      navigate('/admin');
    } else {
      setError("Invalid Security PIN.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (isFirebaseConfigured) {
        await sendPasswordResetEmail(auth, email);
        setMessage("Password reset email sent! Please check your inbox and spam folder.");
        showToast("Reset email sent successfully", "success");
      } else {
        setMessage("Demo Mode: Password reset email 'sent' to " + email);
        showToast("Demo: Reset email 'sent'", "success");
      }
    } catch (err: any) {
      console.error("Reset email error:", err);
      setError("Failed to send reset email. " + err.message);
      showToast("Failed to send reset email", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (isFirebaseConfigured) {
        await signInWithPopup(auth, googleProvider);
        window.dispatchEvent(new Event('user-login'));
        navigate('/');
      } else {
        // Demo Mode
        localStorage.setItem('demo_user', JSON.stringify({ email: ADMIN_EMAIL, role: 'admin', name: 'Admin User' }));
        window.dispatchEvent(new Event('user-login'));
        navigate('/admin');
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      setError("Google Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-20">
      <div id="recaptcha-container"></div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[48px] shadow-2xl border border-stone-100 text-center"
      >
        <div className="w-20 h-20 bg-organic-green rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-organic-green/20">
          <Leaf size={40} />
        </div>
        
        <AnimatePresence mode="wait">
          {step === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-4xl font-serif font-bold mb-2">Welcome Back</h2>
              <p className="text-stone-400 mb-8">Sign in to manage your store</p>

              <div className="flex gap-2 mb-8 p-1 bg-stone-50 rounded-2xl">
                <button 
                  onClick={() => setLoginMethod('email')}
                  className={`flex-grow py-3 rounded-xl font-bold text-sm transition-all ${loginMethod === 'email' ? 'bg-white text-organic-green shadow-sm' : 'text-stone-400'}`}
                >
                  Email
                </button>
                <button 
                  onClick={() => setLoginMethod('phone')}
                  className={`flex-grow py-3 rounded-xl font-bold text-sm transition-all ${loginMethod === 'phone' ? 'bg-white text-organic-green shadow-sm' : 'text-stone-400'}`}
                >
                  Mobile
                </button>
              </div>

              {error && <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold">{error}</div>}
              {message && <div className="bg-green-50 text-green-600 p-4 rounded-2xl mb-6 text-sm font-bold">{message}</div>}

              {loginMethod === 'email' ? (
                <form onSubmit={handleEmailLogin} className="space-y-6 text-left">
                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white border border-stone-200 text-stone-700 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-stone-50 transition-all mb-4"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    Continue with Google
                  </button>
                  
                  <div className="relative flex items-center gap-4 mb-6">
                    <div className="flex-grow h-px bg-stone-100"></div>
                    <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">OR</span>
                    <div className="flex-grow h-px bg-stone-100"></div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-stone-500 ml-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                      <input 
                        required
                        type="email" 
                        placeholder="your@email.com"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-2">
                      <label className="block text-sm font-bold text-stone-500">Password</label>
                      <button 
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-organic-green font-bold hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                      <input 
                        required
                        type="password" 
                        placeholder="••••••••"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-organic-green text-white py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-organic-green/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePhoneLogin} className="space-y-6 text-left">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-stone-500 ml-2">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                      <input 
                        required
                        type="tel" 
                        placeholder="+91 9876543210"
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-organic-green text-white py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-organic-green/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Send OTP
                  </button>
                </form>
              )}
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-4xl font-serif font-bold mb-2">Verify OTP</h2>
              <p className="text-stone-400 mb-10">Enter the 6-digit code sent to your phone</p>

              {error && <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold">{error}</div>}

              <form onSubmit={handleVerifyOtp} className="space-y-6 text-left">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-stone-500 ml-2">OTP Code</label>
                  <input 
                    required
                    type="text" 
                    maxLength={6}
                    placeholder="123456"
                    className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green text-center text-2xl tracking-[1em] font-bold"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-organic-green text-white py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-organic-green/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  Verify OTP
                </button>
                <button 
                  type="button"
                  onClick={() => setStep('login')}
                  className="w-full text-stone-400 font-bold text-sm hover:text-stone-600"
                >
                  Back to Login
                </button>
              </form>
            </motion.div>
          )}

          {step === 'mfa' && (
            <motion.div
              key="mfa"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="w-16 h-16 bg-organic-green/10 text-organic-green rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-serif font-bold mb-2">Multi-Factor Auth</h2>
                <p className="text-stone-400">Please enter your 4-digit Security PIN</p>
              </div>

              {error && <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold">{error}</div>}

              <form onSubmit={handleMfaVerify} className="space-y-6">
                <input 
                  required
                  type="password" 
                  maxLength={4}
                  placeholder="••••"
                  className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green text-center text-3xl tracking-[1em] font-bold"
                  value={securityPin}
                  onChange={e => setSecurityPin(e.target.value)}
                />
                <button 
                  type="submit"
                  className="w-full bg-organic-green text-white py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-organic-green/20"
                >
                  Unlock Admin Panel <ArrowRight size={20} />
                </button>
                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">
                  Demo PIN: 1234
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-8 border-t border-stone-50 space-y-4">
          <p className="text-sm text-stone-400">
            New customer? {' '}
            <Link to="/register" className="text-organic-green font-bold hover:underline">
              Create an Account
            </Link>
          </p>
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">
            Are you an admin? {' '}
            <Link to="/admin/login" className="text-stone-600 hover:underline">
              Admin Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
