import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Leaf, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, isFirebaseConfigured } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ADMIN_EMAIL } from '../constants';

interface NavbarProps {
  cartCount: number;
  user: any;
  clearCart: () => void;
  onOpenCart: () => void;
}

export default function Navbar({ cartCount, user, clearCart, onOpenCart }: NavbarProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    if (isFirebaseConfigured) {
      await signOut(auth);
    } else {
      localStorage.removeItem('demo_user');
      window.dispatchEvent(new Event('user-login'));
    }
    clearCart(); // Clear cart on logout for security
    navigate('/');
    setIsOpen(false);
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-organic-green rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Leaf size={20} />
            </div>
            <span className="text-xl font-serif font-bold tracking-tight">Organic Product Store</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-stone-600 hover:text-organic-green transition-colors font-medium">Shop</Link>
            <Link to={user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "/admin" : "/admin/login"} className="text-stone-600 hover:text-organic-green transition-colors font-medium">Admin</Link>
            <button 
              onClick={onOpenCart}
              className="relative p-2 text-stone-600 hover:text-organic-green transition-colors"
            >
              <ShoppingCart size={24} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-organic-green text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </button>
            
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="flex items-center gap-2 text-stone-600 hover:text-organic-green transition-colors">
                  <User size={20} />
                  <span className="text-sm font-bold">{user.displayName || user.name || user.email?.split('@')[0] || 'User'}</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="p-2 text-stone-600 hover:text-organic-green transition-colors">
                <User size={24} />
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-stone-600"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-stone-100 overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-4">
              <Link to="/" onClick={() => setIsOpen(false)} className="text-stone-600 py-2 font-medium">Shop</Link>
              <Link to={user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "/admin" : "/admin/login"} onClick={() => setIsOpen(false)} className="text-stone-600 py-2 font-medium">Admin</Link>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  onOpenCart();
                }} 
                className="flex items-center gap-2 text-stone-600 py-2 font-medium"
              >
                <ShoppingCart size={20} /> Cart ({cartCount})
              </button>
              
              {user ? (
                <>
                  <div className="flex items-center gap-2 text-stone-600 py-2 font-medium border-t border-stone-50 pt-4">
                    <User size={20} /> {user.displayName || user.email}
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-red-500 py-2 font-medium"
                  >
                    <LogOut size={20} /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-stone-600 py-2 font-medium">
                  <User size={20} /> Login / Register
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
