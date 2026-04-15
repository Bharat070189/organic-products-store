import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { auth, isFirebaseConfigured, googleProvider } from '../firebase';
import { Lock, Mail, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ADMIN_EMAIL, ADMIN_PIN, DEFAULT_ADMIN_PASSWORD } from '../constants';

interface AdminLoginProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function AdminLogin({ showToast }: AdminLoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        throw new Error("Access Denied: Only administrators can log in here.");
      }

      if (isFirebaseConfigured) {
        await signInWithEmailAndPassword(auth, email, password);
        setStep('mfa');
      } else {
        // Demo Mode
        if (password === DEFAULT_ADMIN_PASSWORD) {
          setStep('mfa');
        } else {
          throw new Error("Invalid admin credentials.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your admin email address first.");
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (isFirebaseConfigured) {
        await sendPasswordResetEmail(auth, email);
        setMessage("Admin password reset email sent! Please check your inbox (and spam folder).");
        showToast("Reset email sent successfully", "success");
      } else {
        setMessage("Demo Mode: Admin password reset email 'sent' to " + email);
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

  const handleMfaVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityPin === ADMIN_PIN) {
      if (!isFirebaseConfigured) {
        localStorage.setItem('demo_user', JSON.stringify({ email: ADMIN_EMAIL, role: 'admin', name: 'Admin' }));
      }
      window.dispatchEvent(new Event('user-login'));
      navigate('/admin');
    } else {
      setError("Invalid Security PIN.");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (isFirebaseConfigured) {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setStep('mfa');
        } else {
          await auth.signOut();
          throw new Error("Access Denied: Your Google account is not authorized as an administrator.");
        }
      } else {
        // Demo Mode
        setStep('mfa');
      }
    } catch (err: any) {
      console.error("Admin Google login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Google Sign-In is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable Google.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Popup blocked! Please allow popups for this website in your browser settings.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized in Firebase Console. Please add it to 'Authorized domains' in Auth settings.");
      } else {
        setError(err.message || "Google Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[48px] shadow-2xl border border-stone-100 text-center"
      >
        <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-lg">
          <ShieldCheck size={40} />
        </div>
        <h2 className="text-4xl font-serif font-bold mb-2">Admin Portal</h2>
        <p className="text-stone-400 mb-10">Secure access for store managers</p>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-600 p-4 rounded-2xl mb-6 text-sm font-bold">
            {message}
          </div>
        )}

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6 text-left">
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border border-stone-200 text-stone-700 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-stone-50 transition-all mb-4"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Admin Login with Google
            </button>

            <div className="relative flex items-center gap-4 mb-6">
              <div className="flex-grow h-px bg-stone-100"></div>
              <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">OR</span>
              <div className="flex-grow h-px bg-stone-100"></div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-stone-500 ml-2">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  required
                  type="email" 
                  placeholder={ADMIN_EMAIL}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-stone-900"
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
                  className="text-xs text-stone-600 font-bold hover:underline"
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
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-stone-900"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 text-white py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              Verify Identity <ArrowRight size={20} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaVerify} className="space-y-6 text-left">
            <div className="space-y-2 text-center">
              <label className="block text-sm font-bold text-stone-500">Security PIN</label>
              <p className="text-xs text-stone-400 mb-4">Enter the 4-digit administrator PIN</p>
              <input 
                required
                type="password" 
                maxLength={4}
                placeholder="0000"
                className="w-32 mx-auto text-center text-3xl tracking-[1em] p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-stone-900"
                value={securityPin}
                onChange={e => setSecurityPin(e.target.value)}
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-organic-green text-white py-5 rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg"
            >
              Authorize Access <ShieldCheck size={20} />
            </button>
            <button 
              type="button"
              onClick={() => setStep('login')}
              className="w-full text-stone-400 text-sm font-bold hover:text-stone-600"
            >
              Cancel
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
