import { ShoppingCart, Plus } from 'lucide-react';
import { Product } from '../types';
import { motion } from 'framer-motion';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  key?: string | number;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:border-organic-green/30 transition-all duration-300 border border-stone-100 group flex flex-col"
    >
      <div className="aspect-square bg-stone-50 relative overflow-hidden">
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <img 
            src={`https://picsum.photos/seed/${product.id}/400/400`} 
            alt={product.name} 
            className="w-full h-full object-cover opacity-50 grayscale group-hover:scale-110 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      <div className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-stone-50 px-3 py-1 rounded-full text-[10px] font-bold text-organic-green uppercase tracking-widest">
            {product.category}
          </div>
        </div>
        <h3 className="text-xl font-serif font-bold mb-2 group-hover:text-organic-green transition-colors">{product.name}</h3>
        <p className="text-stone-500 text-sm line-clamp-3 mb-4">{product.description}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-lg font-bold text-stone-900">₹{(product.price || 0).toFixed(2)}</span>
          <button 
            onClick={() => onAddToCart(product)}
            className="bg-organic-green text-white p-3 rounded-2xl hover:bg-stone-800 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="text-sm font-bold pr-1">Add</span>
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-50 text-[10px] uppercase tracking-widest text-stone-400 font-bold">
          Stock: {product.stock} units
        </div>
      </div>
    </motion.div>
  );
}
