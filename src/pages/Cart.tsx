import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { motion } from 'framer-motion';

interface CartProps {
  cart: { product: Product; quantity: number }[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
}

export default function Cart({ cart, updateQuantity, removeFromCart }: CartProps) {
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shipping = subtotal > 50 ? 0 : 5;
  const total = subtotal + shipping;

  if (cart.length === 0) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
          <ShoppingBag size={48} />
        </div>
        <h2 className="text-3xl font-serif font-bold">Your cart is empty</h2>
        <p className="text-stone-500 max-w-md mx-auto">
          Looks like you haven't added any organic goodness to your cart yet.
        </p>
        <Link 
          to="/" 
          className="inline-block bg-organic-green text-white px-8 py-4 rounded-full font-bold hover:bg-stone-800 transition-colors"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <div className="lg:col-span-2 space-y-8">
        <h2 className="text-4xl font-serif font-bold">Shopping Cart</h2>
        <div className="space-y-4">
          {cart.map(item => (
            <motion.div 
              layout
              key={item.product.id}
              className="bg-white p-6 rounded-[32px] shadow-sm flex flex-col sm:flex-row items-center gap-6"
            >
              <div className="flex-grow text-center sm:text-left">
                <h3 className="text-xl font-serif font-bold">{item.product.name}</h3>
                <p className="text-stone-400 text-sm">{item.product.category}</p>
                <p className="text-organic-green font-bold mt-1">₹{item.product.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-4 bg-stone-50 p-2 rounded-2xl">
                <button 
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all"
                >
                  <Minus size={18} />
                </button>
                <span className="w-8 text-center font-bold">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="text-right min-w-[100px]">
                <p className="font-bold text-lg">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                <button 
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-stone-300 hover:text-red-500 transition-colors p-2"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white p-8 rounded-[40px] shadow-xl border border-stone-100 sticky top-24">
          <h3 className="text-2xl font-serif font-bold mb-8">Order Summary</h3>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-stone-500">
              <span>Subtotal</span>
              <span className="font-bold text-stone-900">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Shipping</span>
              <span className="font-bold text-stone-900">
                {shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}
              </span>
            </div>
            {shipping > 0 && (
              <p className="text-[10px] text-stone-400 uppercase tracking-widest">
                Free shipping on orders over ₹500
              </p>
            )}
            <div className="border-t border-stone-100 pt-4 flex justify-between items-center">
              <span className="text-lg font-serif font-bold">Total</span>
              <span className="text-3xl font-serif font-bold text-organic-green">₹{total.toFixed(2)}</span>
            </div>
          </div>
          <Link 
            to="/checkout"
            className="w-full bg-organic-green text-white py-5 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-organic-green/20"
          >
            Checkout <ArrowRight size={20} />
          </Link>
          <Link 
            to="/"
            className="w-full text-center block mt-4 text-stone-400 hover:text-stone-600 font-bold text-sm"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
