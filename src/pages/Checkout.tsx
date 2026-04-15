import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc, increment, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from '../firebase';
import { Product, PromoCode, AppSettings, UserProfile } from '../types';
import { CreditCard, Truck, CheckCircle2, Loader2, ArrowLeft, Ticket, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../config';

const GUJARAT_CITIES = [
  'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh', 'Gandhidham', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Mehsana', 'Bhuj', 'Porbandar', 'Palanpur', 'Valsad', 'Vapi', 'Gondal', 'Veraval', 'Godhra', 'Patan', 'Kalol', 'Dahod', 'Botad', 'Amreli', 'Deesa', 'Jetpur'
];

interface CheckoutProps {
  cart: { product: Product; quantity: number }[];
  clearCart: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  user: any;
  isAuthLoading: boolean;
}

export default function Checkout({ cart, clearCart, showToast, user, isAuthLoading }: CheckoutProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ 
    shippingCharge: 50, 
    minOrderForFreeShipping: 1000,
    lowStockThreshold: 5,
    razorpayEnabled: true
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    zip: '',
    paymentMethod: 'cod' as 'cod' | 'online'
  });

  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate('/login');
      return;
    }

    const fetchInitialData = async () => {
      if (!user) return;

      // Fetch Settings
      try {
        if (isFirebaseConfigured) {
          const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
          if (settingsSnap.exists()) setSettings(settingsSnap.data() as AppSettings);
        } else {
          const localSettings = localStorage.getItem('demo_settings');
          if (localSettings) setSettings(JSON.parse(localSettings));
        }
      } catch (e) { console.error(e); }

      // Auth & Profile
      setFormData(prev => ({ ...prev, email: user.email || '', name: user.displayName || '' }));
      
      if (isFirebaseConfigured && db) {
        // Fetch Profile
        try {
          const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
          if (profileSnap.exists()) {
            const profile = profileSnap.data() as UserProfile;
            setSavedAddresses(profile.addresses || []);
            if (profile.addresses && profile.addresses.length > 0) {
              const first = profile.addresses[0];
              setFormData(prev => ({
                ...prev,
                address: first.address,
                city: first.city,
                state: first.state,
                zip: first.pincode
              }));
              setAutoFilled(true);
            }
          }
        } catch (e) { console.error(e); }
      } else {
        // Demo Mode
        const localProfile = localStorage.getItem(`demo_profile_${user.uid}`);
        if (localProfile) {
          const profile = JSON.parse(localProfile);
          setSavedAddresses(profile.addresses || []);
          if (profile.addresses && profile.addresses.length > 0) {
            const first = profile.addresses[0];
            setFormData(prev => ({
              ...prev,
              address: first.address,
              city: first.city,
              state: first.state,
              zip: first.pincode
            }));
            setAutoFilled(true);
          }
        }
      }
    };
    fetchInitialData();
  }, [user, isAuthLoading]);

  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  
  let discount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'percentage') {
      discount = (subtotal * appliedPromo.discountValue) / 100;
    } else {
      discount = appliedPromo.discountValue;
    }
  }

  const shipping = subtotal >= settings.minOrderForFreeShipping ? 0 : settings.shippingCharge;
  const total = subtotal - discount + shipping;

  const handleApplyPromo = async () => {
    setPromoError('');
    if (!promoCode.trim()) return;

    try {
      let promo: PromoCode | null = null;
      if (isFirebaseConfigured) {
        const q = query(collection(db, 'promocodes'), where('code', '==', promoCode.toUpperCase()), where('isActive', '==', true));
        const snap = await getDocs(q);
        if (!snap.empty) promo = { id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode;
      } else {
        const local = JSON.parse(localStorage.getItem('demo_promocodes') || '[]');
        promo = local.find((p: any) => p.code === promoCode.toUpperCase() && p.isActive);
      }

      if (!promo) {
        setPromoError('Invalid or expired promo code.');
      } else if (subtotal < promo.minOrderAmount) {
        setPromoError(`Minimum order of ₹${promo.minOrderAmount} required.`);
      } else {
        setAppliedPromo(promo);
      }
    } catch (e) { setPromoError('Error applying promo code.'); }
  };

  const [paymentStep, setPaymentStep] = useState<'details' | 'payment'>('details');

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (total < 1) {
        showToast("Minimum order amount for online payment is ₹1.", "error");
        setLoading(false);
        return;
      }

      const res = await loadRazorpay();
      if (!res) {
        showToast("Razorpay SDK failed to load. Are you online?", "error");
        setLoading(false);
        return;
      }

      console.log(`[Checkout] Creating order for amount: ${total}`);
      const response = await fetch(`${API_BASE}/api/create-razorpay-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Server error" }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const order = await response.json();
      
      if (order.id) {
        console.log(`[Checkout] Order created successfully:`, order);
        const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
        console.log(`[Checkout] Using Razorpay Key ID: ${razorpayKey ? razorpayKey.substring(0, 8) + '...' : 'MISSING'}`);
        
        if (!razorpayKey) {
          console.error("[Checkout] Razorpay Key ID is missing in frontend environment.");
          showToast("Razorpay Key ID is missing. Please check your configuration.", "error");
          setLoading(false);
          return;
        }

        const options = {
          key: razorpayKey,
          amount: order.amount,
          currency: order.currency,
          name: "Organic Store",
          description: "Order Payment",
          order_id: order.id,
          handler: function (response: any) {
            console.log("[Checkout] Payment successful response:", response);
            processOrder();
          },
          prefill: {
            name: formData.name,
            email: formData.email,
          },
          theme: {
            color: "#4a5d23",
          },
          modal: {
            ondismiss: function() {
              console.log("[Checkout] Payment window closed by user");
              setLoading(false);
            }
          }
        };

        try {
          console.log("[Checkout] Initializing Razorpay with options:", { ...options, key: 'HIDDEN' });
          const rzp = new (window as any).Razorpay(options);
          
          rzp.on('payment.failed', function (response: any) {
            console.error("[Checkout] Payment failed:", response.error);
            showToast(`Payment failed: ${response.error.description}`, "error");
            setLoading(false);
          });

          console.log("[Checkout] Opening Razorpay modal...");
          rzp.open();
        } catch (rzpError: any) {
          console.error("[Checkout] Razorpay initialization error:", rzpError);
          showToast(`Razorpay error: ${rzpError.message}`, "error");
          setLoading(false);
        }
      } else {
        console.error("[Checkout] Order creation failed on server - no order ID returned:", order);
        showToast(order.error || "Failed to initialize payment.", "error");
      }
    } catch (error: any) {
      console.error("Payment initialization error details:", error);
      const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
      showToast(errorMessage || "Error connecting to payment gateway.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFirestoreError = (error: any, operationType: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const processOrder = async () => {
    setLoading(true);
    try {
      const orderData = {
        customerName: formData.name,
        customerEmail: formData.email,
        customerAddress: formData.address,
        customerCity: formData.city,
        customerState: formData.state,
        customerPincode: formData.zip,
        paymentMethod: formData.paymentMethod,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity
        })),
        subtotal,
        discount,
        shipping,
        total,
        status: 'pending',
        createdAt: Date.now(),
        uid: user?.uid || 'guest'
      };

      if (isFirebaseConfigured) {
        try {
          await addDoc(collection(db, 'orders'), orderData);
        } catch (e) {
          handleFirestoreError(e, 'create', 'orders');
        }

        for (const item of cart) {
          try {
            await updateDoc(doc(db, 'products', item.product.id), { stock: increment(-item.quantity) });
          } catch (e) {
            handleFirestoreError(e, 'update', `products/${item.product.id}`);
          }
        }

        if (saveAddress && user) {
          try {
            const profileRef = doc(db, 'profiles', user.uid);
            const profileSnap = await getDoc(profileRef);
            let addresses = [];
            if (profileSnap.exists()) {
              addresses = (profileSnap.data() as UserProfile).addresses || [];
            }
            
            const newAddr = {
              id: Math.random().toString(36).substr(2, 9),
              label: addressLabel,
              address: formData.address,
              city: formData.city,
              state: formData.state,
              pincode: formData.zip
            };
            
            const exists = addresses.find((a: any) => a.address === newAddr.address && a.city === newAddr.city);
            if (!exists) {
              addresses.push(newAddr);
              await setDoc(profileRef, { 
                uid: user.uid,
                email: user.email,
                name: formData.name,
                addresses 
              }, { merge: true });
            }
          } catch (e) {
            handleFirestoreError(e, 'write', `profiles/${user.uid}`);
          }
        }
      } else {
        // Demo Mode
        const localOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        localStorage.setItem('demo_orders', JSON.stringify([{ ...orderData, id: Math.random().toString(36).substr(2, 9) }, ...localOrders]));
        if (saveAddress && user) {
          const localProfile = JSON.parse(localStorage.getItem(`demo_profile_${user.uid}`) || '{"addresses":[]}');
          const newAddr = {
            id: Math.random().toString(36).substr(2, 9),
            label: addressLabel,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.zip
          };
          const exists = localProfile.addresses?.find((a: any) => a.address === newAddr.address && a.city === newAddr.city);
          if (!exists) {
            const updatedAddresses = [...(localProfile.addresses || []), newAddr];
            localStorage.setItem(`demo_profile_${user.uid}`, JSON.stringify({ ...localProfile, uid: user.uid, email: user.email, name: formData.name, addresses: updatedAddresses }));
          }
        }
      }

      setSuccess(true);
      clearCart();
      showToast("Order placed successfully!", "success");
      setTimeout(() => navigate('/'), 5000);
    } catch (error) {
      showToast("Error placing order. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.paymentMethod === 'online') {
      handlePaymentSubmit(e);
    } else {
      processOrder();
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-8">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600"
        >
          <CheckCircle2 size={64} />
        </motion.div>
        <h2 className="text-5xl font-serif font-bold">Order Placed!</h2>
        <p className="text-stone-500 text-lg">
          Thank you for your purchase. We've received your order and we're getting it ready for delivery.
          You'll receive a confirmation email shortly.
        </p>
        <div className="pt-8">
          <button 
            onClick={() => navigate('/')}
            className="bg-organic-green text-white px-12 py-5 rounded-3xl font-bold shadow-xl shadow-organic-green/20"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <button 
        onClick={() => navigate('/cart')}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-600 mb-8 font-bold transition-colors"
      >
        <ArrowLeft size={20} /> Back to Cart
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div className="space-y-12">
          <h2 className="text-4xl font-serif font-bold">
            {paymentStep === 'details' ? 'Checkout' : 'Payment Details'}
          </h2>
          {autoFilled && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-organic-green/10 text-organic-green px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <CheckCircle2 size={16} /> Address auto-filled from your profile
              <button onClick={() => setAutoFilled(false)} className="ml-auto hover:scale-110 transition-transform">
                <X size={14} />
              </button>
            </motion.div>
          )}
          
          <AnimatePresence mode="wait">
            {paymentStep === 'details' ? (
              <motion.form 
                key="details"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSubmit} 
                className="space-y-8"
              >
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                    <h3 className="text-xl font-serif font-bold">Shipping Information</h3>
                    {savedAddresses.length > 0 && (
                      <div className="flex gap-2">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              address: addr.address,
                              city: addr.city,
                              state: addr.state,
                              zip: addr.pincode
                            }))}
                            className="px-3 py-1 text-xs font-bold rounded-full border border-stone-200 hover:border-organic-green hover:text-organic-green transition-colors"
                          >
                            {addr.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Full Name</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Email Address</label>
                      <input 
                        required
                        type="email" 
                        className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Street Address</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">City</label>
                        <select 
                          required
                          className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
                          value={formData.city}
                          onChange={e => setFormData({...formData, city: e.target.value})}
                        >
                          {GUJARAT_CITIES.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">State</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
                          value={formData.state}
                          onChange={e => setFormData({...formData, state: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Pincode</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-4 rounded-2xl bg-white border-none focus:ring-2 focus:ring-organic-green shadow-sm"
                        value={formData.zip}
                        onChange={e => setFormData({...formData, zip: e.target.value})}
                        placeholder="6-digit pincode"
                      />
                    </div>
                    {user && (
                      <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${saveAddress ? 'bg-organic-green border-organic-green' : 'border-stone-200 group-hover:border-organic-green'}`}>
                            {saveAddress && <Save size={14} className="text-white" />}
                          </div>
                          <input type="checkbox" className="hidden" checked={saveAddress} onChange={e => setSaveAddress(e.target.checked)} />
                          <span className="text-sm font-bold text-stone-600">Save this address for future orders</span>
                        </label>

                        {saveAddress && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-2"
                          >
                            {(['Home', 'Office', 'Other'] as const).map((label) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setAddressLabel(label)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${addressLabel === label ? 'bg-organic-green text-white border-organic-green' : 'bg-white text-stone-500 border-stone-100 hover:border-stone-200'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-xl font-serif font-bold border-b border-stone-100 pb-4">Payment Method</h3>
                  <div className={`grid ${settings.razorpayEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, paymentMethod: 'cod'})}
                      className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${
                        formData.paymentMethod === 'cod' 
                          ? 'border-organic-green bg-organic-green/5 text-organic-green' 
                          : 'border-stone-100 bg-white text-stone-400'
                      }`}
                    >
                      <Truck size={32} />
                      <span className="font-bold">Cash on Delivery</span>
                    </button>
                    {settings.razorpayEnabled && (
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, paymentMethod: 'online'})}
                        className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${
                          formData.paymentMethod === 'online' 
                            ? 'border-organic-green bg-organic-green/5 text-organic-green' 
                            : 'border-stone-100 bg-white text-stone-400'
                        }`}
                      >
                        <CreditCard size={32} />
                        <span className="font-bold">Online Payment</span>
                      </button>
                    )}
                  </div>
                </section>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-organic-green text-white py-6 rounded-[32px] font-bold text-xl flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-xl shadow-organic-green/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  {formData.paymentMethod === 'online' ? 'Continue to Payment' : `Place Order (₹${total.toFixed(2)})`}
                </button>
              </motion.form>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[48px] shadow-xl border border-stone-100">
            <h3 className="text-2xl font-serif font-bold mb-8">Order Summary</h3>
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 mb-8">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 font-bold text-xs relative">
                    {item.quantity}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-bold text-sm">{item.product.name}</h4>
                    <p className="text-xs text-stone-400">{item.product.category}</p>
                  </div>
                  <span className="font-bold">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4 pt-6 border-t border-stone-50">
              <div className="flex flex-col gap-2 mb-4">
                <label className="text-sm font-bold text-stone-500">Promo Code</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter code"
                    className="flex-grow p-3 rounded-xl bg-stone-50 border-none text-sm focus:ring-2 focus:ring-organic-green"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  />
                  <button 
                    type="button"
                    onClick={handleApplyPromo}
                    className="bg-stone-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-organic-green transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-xs text-red-500 font-bold">{promoError}</p>}
                {appliedPromo && (
                  <div className="flex items-center justify-between bg-green-50 p-2 rounded-lg border border-green-100">
                    <span className="text-xs text-green-700 font-bold flex items-center gap-1">
                      <Ticket size={12} /> {appliedPromo.code} Applied
                    </span>
                    <button onClick={() => setAppliedPromo(null)} className="text-green-700"><X size={14} /></button>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="font-bold text-stone-900">₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="font-bold">-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-500">
                <span>Shipping</span>
                <span className="font-bold text-stone-900">{shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between items-center pt-4">
                <span className="text-xl font-serif font-bold">Total</span>
                <span className="text-4xl font-serif font-bold text-organic-green">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
