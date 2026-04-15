import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { Link } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: { product: Product; quantity: number }[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
}

export default function CartDrawer({ isOpen, onClose, cart, updateQuantity, removeFromCart }: CartDrawerProps) {
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-organic-green/10 rounded-full flex items-center justify-center text-organic-green">
                  <ShoppingBag size={20} />
                </div>
                <h2 className="text-xl font-serif font-bold">Your Cart</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center text-stone-300">
                    <ShoppingBag size={32} />
                  </div>
                  <p className="text-stone-500 font-medium">Your cart is empty</p>
                  <button 
                    onClick={onClose}
                    className="text-organic-green font-bold text-sm hover:underline"
                  >
                    Start shopping
                  </button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="flex gap-4 group">
                    <div className="w-20 h-20 bg-stone-50 rounded-2xl overflow-hidden flex-shrink-0">
                      {item.product.image ? (
                        <img 
                          src={item.product.image} 
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <ShoppingBag size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-stone-800 line-clamp-1">{item.product.name}</h3>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-stone-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="text-stone-400 text-xs mb-2">{item.product.category}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 bg-stone-50 px-2 py-1 rounded-lg">
                          <button 
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="text-stone-400 hover:text-stone-600"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="text-stone-400 hover:text-stone-600"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="font-bold text-stone-900">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-stone-100 bg-stone-50/50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 font-medium">Subtotal</span>
                  <span className="text-2xl font-serif font-bold text-stone-900">₹{subtotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-stone-400 uppercase tracking-widest text-center">
                  Shipping & taxes calculated at checkout
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Link 
                    to="/cart"
                    onClick={onClose}
                    className="py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 text-center hover:bg-white transition-colors"
                  >
                    View Cart
                  </Link>
                  <Link 
                    to="/checkout"
                    onClick={onClose}
                    className="py-4 rounded-2xl bg-organic-green text-white font-bold text-center hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                  >
                    Checkout <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
