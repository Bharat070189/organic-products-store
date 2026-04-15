import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { Product, Banner } from '../types';
import ProductCard from '../components/ProductCard';
import { Search, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HomeProps {
  addToCart: (product: Product) => void;
}

export default function Home({ addToCart }: HomeProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [rotationInterval, setRotationInterval] = useState(10); // Default 10 seconds
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isFirebaseConfigured && db) {
          const productsSnap = await getDocs(collection(db, 'products'));
          setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);

          const bannersSnap = await getDocs(query(collection(db, 'banners'), where('isActive', '==', true)));
          setBanners(bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Banner[]);
        } else if (!isFirebaseConfigured) {
          // Demo Mode
          setProducts(JSON.parse(localStorage.getItem('demo_products') || '[]'));
          setBanners(JSON.parse(localStorage.getItem('demo_banners') || '[]'));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const timer = setInterval(() => {
        setCurrentBanner(prev => (prev + 1) % banners.length);
      }, rotationInterval * 1000);
      return () => clearInterval(timer);
    }
  }, [banners.length, rotationInterval]);

  const categories = ['All', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const nextBanner = () => setCurrentBanner(prev => (prev + 1) % banners.length);
  const prevBanner = () => setCurrentBanner(prev => (prev - 1 + banners.length) % banners.length);

  return (
    <div className="space-y-12">
      {!isFirebaseConfigured && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-700">
          <ArrowRight size={20} className="rotate-180" />
          <p className="text-sm font-medium">
            <strong>Demo Mode:</strong> Using local storage for products. Configure Firebase for a real database.
          </p>
        </div>
      )}

      {/* Hero Section / Banner Slider - Only shows if admin has uploaded banners */}
      {banners.length > 0 && (
        <section className="relative h-[500px] rounded-[40px] overflow-hidden bg-stone-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={banners[currentBanner].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center"
            >
              <img 
                src={banners[currentBanner].imageUrl} 
                alt={banners[currentBanner].title}
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="relative z-10 container mx-auto px-12 text-white max-w-2xl">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-6xl font-serif font-bold leading-tight mb-6"
                >
                  {banners[currentBanner].title}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-stone-300 mb-8"
                >
                  {banners[currentBanner].subtitle}
                </motion.p>
                <motion.button 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => {
                    const el = document.getElementById('products-grid');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-organic-green text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-white hover:text-organic-green transition-all"
                >
                  Shop Now <ArrowRight size={20} />
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>

          {banners.length > 1 && (
            <>
              <button onClick={prevBanner} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all">
                <ChevronLeft size={24} />
              </button>
              <button onClick={nextBanner} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all">
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {banners.map((_, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setCurrentBanner(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${currentBanner === idx ? 'bg-organic-green w-8' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Filters & Search */}
      <section id="products-grid" className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-organic-green text-white' 
                  : 'bg-white text-stone-600 hover:bg-stone-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
          />
        </div>
      </section>

      {/* Product Grid */}
      <section>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-3xl h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAddToCart={addToCart} 
              />
            ))}
          </div>
        )}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-stone-500 text-lg">No products found matching your criteria.</p>
          </div>
        )}
      </section>
    </div>
  );
}
