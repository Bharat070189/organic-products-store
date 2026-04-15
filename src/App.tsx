import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Register from './pages/Register';
import FeedbackForm from './components/FeedbackForm';
import CartDrawer from './components/CartDrawer';
import { Product } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean; type: 'success' | 'error' }>({
    message: '',
    visible: false,
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  useEffect(() => {
    let unsubscribe: any;
    
    const checkAuth = () => {
      setLoading(true);
      const demoUser = localStorage.getItem('demo_user');
      
      if (isFirebaseConfigured && auth) {
        // Add a timeout for Firebase auth check
        const authTimeout = setTimeout(() => {
          if (loading) {
            console.warn("Firebase auth check timed out");
            setLoading(false);
          }
        }, 5000);

        unsubscribe = onAuthStateChanged(auth, (u) => {
          clearTimeout(authTimeout);
          if (u) {
            setUser(u);
          } else if (demoUser) {
            setUser(JSON.parse(demoUser));
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } else if (demoUser) {
        setUser(JSON.parse(demoUser));
        setLoading(false);
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for demo user changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'demo_user') {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for same-window updates
    const handleUserUpdate = () => {
      checkAuth();
    };
    window.addEventListener('user-login', handleUserUpdate);

    return () => {
      unsubscribe && unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-login', handleUserUpdate);
    };
  }, []);

  useEffect(() => {
    if (!user && cart.length > 0) {
      setCart([]);
    }
  }, [user]);

  const addToCart = (product: Product) => {
    if (!user || !user.email) {
      showToast("Please login to add products to your cart.", "error");
      setTimeout(() => navigate('/login'), 1500);
      return;
    }

    // Extra security check for stock
    if (product.stock <= 0) {
      showToast("This product is currently out of stock.", "error");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    showToast(`${product.name} added to cart!`, "success");
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setCart([]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar 
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)} 
        user={user} 
        clearCart={clearCart} 
        onOpenCart={() => setIsCartOpen(true)}
      />
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart} 
        updateQuantity={updateQuantity} 
        removeFromCart={removeFromCart} 
      />
      <main className="flex-grow container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-organic-green"></div>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Home addToCart={addToCart} />} />
            <Route path="/cart" element={
              <Cart 
                cart={cart} 
                updateQuantity={updateQuantity} 
                removeFromCart={removeFromCart} 
              />
            } />
            <Route path="/checkout" element={
              <Checkout 
                cart={cart} 
                clearCart={clearCart} 
                showToast={showToast}
                user={user}
                isAuthLoading={loading}
              />
            } />
            <Route path="/admin/login" element={<AdminLogin showToast={showToast} />} />
            <Route path="/admin/*" element={<Admin user={user} isAuthLoading={loading} showToast={showToast} />} />
            <Route path="/login" element={<Login showToast={showToast} />} />
            <Route path="/register" element={<Register showToast={showToast} />} />
          </Routes>
        )}
      </main>
      <footer className="bg-stone-900 text-stone-400 py-12 mt-auto">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-serif text-white mb-4">Organic Product Store</h2>
            <p className="max-w-md mx-auto mb-8">
              Bringing the freshest organic produce directly from local farms to your doorstep.
            </p>
            <div className="border-t border-stone-800 pt-8 text-sm">
              © {new Date().getFullYear()} Organic Product Store. All rights reserved.
            </div>
          </div>
        </footer>
        <FeedbackForm showToast={showToast} />
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toast.visible && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className={`fixed bottom-8 left-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
                toast.type === 'success' 
                  ? 'bg-white border-green-100 text-stone-800' 
                  : 'bg-red-50 border-red-100 text-red-800'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="text-green-500" size={20} />
              ) : (
                <AlertCircle className="text-red-500" size={20} />
              )}
              <span className="font-bold text-sm">{toast.message}</span>
              <button 
                onClick={() => setToast(prev => ({ ...prev, visible: false }))}
                className="ml-4 text-stone-400 hover:text-stone-600"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}

