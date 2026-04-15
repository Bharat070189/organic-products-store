import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';
import { Lock, Mail, Loader2, Leaf, User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface RegisterProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function Register({ showToast }: RegisterProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isFirebaseConfigured) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        navigate('/');
      } else {
        // Demo Mode
        console.log("Demo Register:", { name, email });
        localStorage.setItem('demo_user', JSON.stringify({ name, email, role: 'customer' }));
        window.dispatchEvent(new Event('user-login'));
        navigate('/');
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password registration is not enabled in Firebase Console.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
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
        <div className="w-20 h-20 bg-organic-green rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-organic-green/20">
          <Leaf size={40} />
        </div>
        <h2 className="text-4xl font-serif font-bold mb-2">Create Account</h2>
        <p className="text-stone-400 mb-10">Join our organic community</p>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-2xl mb-6 text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-stone-500 ml-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
              <input 
                required
                type="text" 
                placeholder="John Doe"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-stone-500 ml-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
              <input 
                required
                type="email" 
                placeholder="john@example.com"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-stone-500 ml-2">Password</label>
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
            Sign Up <ArrowRight size={20} />
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-stone-50">
          <p className="text-sm text-stone-400">
            Already have an account? {' '}
            <Link to="/login" className="text-organic-green font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
