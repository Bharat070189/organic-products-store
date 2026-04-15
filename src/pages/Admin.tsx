import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db, storage, isFirebaseConfigured } from '../firebase';
import { Product, Order, Category, PromoCode, Banner, AppSettings } from '../types';
import { ADMIN_EMAIL } from '../constants';
import { Plus, Trash2, Package, BarChart3, ShoppingBag, Settings, LayoutDashboard, Loader2, AlertCircle, MessageSquare, Lock, Tags, Edit2, Camera, Image as ImageIcon, X, Download, Ticket, Image as BannerIcon, Sliders, User, ArrowRight, Database, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AdminProps {
  user: any;
  isAuthLoading: boolean;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

import { API_BASE } from '../config';

export default function Admin({ user: propUser, isAuthLoading, showToast }: AdminProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'sales' | 'stock' | 'feedback' | 'categories' | 'promocodes' | 'banners' | 'settings' | 'customers' | 'security'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promocodes, setPromocodes] = useState<PromoCode[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ 
    shippingCharge: 50, 
    minOrderForFreeShipping: 1000,
    lowStockThreshold: 10,
    razorpayEnabled: true
  });
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isDemoAdmin, setIsDemoAdmin] = useState(false);
  const [localOrdersCount, setLocalOrdersCount] = useState(0);
  const [localProductsCount, setLocalProductsCount] = useState(0);
  const [razorpayConfig, setRazorpayConfig] = useState<{ 
    key_id_set: boolean; 
    key_secret_set: boolean; 
    key_id_prefix?: string | null; 
    key_id_length?: number;
    key_secret_length?: number;
    error?: string 
  } | null>(null);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [backendUrlOverride, setBackendUrlOverride] = useState<string>(localStorage.getItem('backend_url_override') || '');
  const [apiBase, setApiBase] = useState<string>(localStorage.getItem('backend_url_override') || API_BASE);

  // Form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'Vegetables',
    image: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthLoading && !propUser && !localStorage.getItem('demo_user')) {
      navigate('/admin/login');
      return;
    }

    if (!isAuthLoading && propUser && propUser.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      navigate('/');
      return;
    }

    if (!isAuthLoading && (propUser || localStorage.getItem('demo_user'))) {
      const demoUser = localStorage.getItem('demo_user');
      const demoUserObj = demoUser ? JSON.parse(demoUser) : null;
      const isDemo = demoUserObj && demoUserObj.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setIsDemoAdmin(isDemo);
      setIsAuthChecking(false);
      fetchData(isDemo);
    }
  }, [propUser, isAuthLoading]);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const testConnection = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      if (!isFirebaseConfigured) throw new Error("Firebase keys not found in Secrets panel.");
      
      // Try to write a test document
      const testRef = await addDoc(collection(db, 'connection_tests'), {
        timestamp: Date.now(),
        message: 'Connection test from Admin panel'
      });
      
      // Try to delete it immediately
      await deleteDoc(doc(db, 'connection_tests', testRef.id));
      
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (error: any) {
      console.error("Connection test failed:", error);
      setTestStatus('error');
      setTestError(error.message || "Unknown error");
    }
  };

  const seedData = async () => {
    if (!confirm("This will add some default organic products and categories to your real Firebase database. Continue?")) return;
    
    setLoading(true);
    try {
      const defaultCategories = [
        { name: 'Vegetables', createdAt: Date.now() },
        { name: 'Fruits', createdAt: Date.now() },
        { name: 'Bakery', createdAt: Date.now() },
        { name: 'Pantry', createdAt: Date.now() },
        { name: 'Dairy', createdAt: Date.now() }
      ];

      const defaultProducts = [
        { name: 'Organic Avocados', description: 'Creamy avocados harvested from local sustainable farms.', price: 499, stock: 50, category: 'Vegetables', createdAt: Date.now(), image: 'https://picsum.photos/seed/avocado/800/800' },
        { name: 'Fresh Strawberries', description: 'Sweet and juicy organic strawberries.', price: 650, stock: 30, category: 'Fruits', createdAt: Date.now(), image: 'https://picsum.photos/seed/strawberry/800/800' },
        { name: 'Whole Wheat Bread', description: 'Freshly baked organic whole wheat bread.', price: 120, stock: 20, category: 'Bakery', createdAt: Date.now(), image: 'https://picsum.photos/seed/bread/800/800' },
        { name: 'Organic Honey', description: 'Pure, raw organic honey from wildflower blossoms.', price: 850, stock: 15, category: 'Pantry', createdAt: Date.now(), image: 'https://picsum.photos/seed/honey/800/800' }
      ];

      // Add categories
      for (const cat of defaultCategories) {
        await addDoc(collection(db, 'categories'), cat);
      }

      // Add products
      for (const prod of defaultProducts) {
        await addDoc(collection(db, 'products'), prod);
      }

      alert("Database seeded successfully with default products and categories!");
      fetchData();
    } catch (error: any) {
      alert("Seeding failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const migrateData = async () => {
    if (!confirm("This will upload all your local demo products and orders to your real Firebase database. Continue?")) return;
    
    setLoading(true);
    try {
      const localProducts = JSON.parse(localStorage.getItem('demo_products') || '[]');
      const localOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');

      // Upload products
      for (const product of localProducts) {
        const { id, ...data } = product;
        await addDoc(collection(db, 'products'), data);
      }

      // Upload orders
      for (const order of localOrders) {
        const { id, ...data } = order;
        await addDoc(collection(db, 'orders'), data);
      }

      alert(`Successfully migrated ${localProducts.length} products and ${localOrders.length} orders to Firebase!`);
      localStorage.removeItem('demo_products');
      localStorage.removeItem('demo_orders');
      fetchData();
    } catch (error: any) {
      alert("Migration failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (id: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    try {
      if (isFirebaseConfigured && !isDemoAdmin) {
        await updateDoc(doc(db, 'orders', id), { status: newStatus });
      } else {
        // Demo Mode
        const localOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        const updated = localOrders.map((o: any) => o.id === id ? { ...o, status: newStatus } : o);
        localStorage.setItem('demo_orders', JSON.stringify(updated));
      }
      fetchData(isDemoAdmin);
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const [newPromo, setNewPromo] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    minOrderAmount: 0,
    isActive: true
  });

  const [newBanner, setNewBanner] = useState({
    title: '',
    subtitle: '',
    link: '',
    isActive: true
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New passwords do not match.");
      return;
    }

    if (isDemoAdmin) {
      alert("Password change is disabled in Demo Mode.");
      return;
    }

    setPasswordLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user logged in.");

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email!, passwordForm.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordForm.newPassword);
      alert("Password updated successfully!");
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error("Password change error:", error);
      alert("Failed to update password: " + (error.message || "Unknown error"));
    } finally {
      setPasswordLoading(false);
    }
  };

  const fetchData = async (demoOverride?: boolean) => {
    setLoading(true);
    setFetchError(null);
    try {
      const effectiveIsDemoAdmin = demoOverride !== undefined ? demoOverride : isDemoAdmin;

      if (isFirebaseConfigured) {
        const [prodSnap, orderSnap, feedbackSnap, catSnap, promoSnap, bannerSnap, settingsSnap, userSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'categories'), orderBy('name', 'asc'))),
          getDocs(query(collection(db, 'promocodes'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'banners'), orderBy('createdAt', 'desc'))),
          getDoc(doc(db, 'settings', 'app')),
          getDocs(collection(db, 'profiles'))
        ]);

        const productsData = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        setProducts(productsData);
        setOrders(orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
        setFeedback(feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const categoriesData = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
        setCategories(categoriesData);
        setPromocodes(promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PromoCode[]);
        setBanners(bannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Banner[]);
        if (settingsSnap.exists()) setAppSettings(settingsSnap.data() as AppSettings);
        setCustomers(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        // Check for local data to migrate
        const localOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        const localProducts = JSON.parse(localStorage.getItem('demo_products') || '[]');
        setLocalOrdersCount(localOrders.length);
        setLocalProductsCount(localProducts.length);

        if (categoriesData.length > 0 && !newProduct.category) {
          setNewProduct(prev => ({ ...prev, category: categoriesData[0].name }));
        }
      } else {
        // Demo Mode: Load from localStorage
        const productsRaw = localStorage.getItem('demo_products');
        const categoriesRaw = localStorage.getItem('demo_categories');
        const promoRaw = localStorage.getItem('demo_promocodes');
        const bannerRaw = localStorage.getItem('demo_banners');
        const settingsRaw = localStorage.getItem('demo_settings');
        
        const localProducts = productsRaw ? JSON.parse(productsRaw) : null;
        const localOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        const localFeedback = JSON.parse(localStorage.getItem('demo_feedback') || '[]');
        const localCategories = categoriesRaw ? JSON.parse(categoriesRaw) : null;
        const localPromos = promoRaw ? JSON.parse(promoRaw) : [];
        const localBanners = bannerRaw ? JSON.parse(bannerRaw) : [];
        const localSettings = settingsRaw ? JSON.parse(settingsRaw) : { shippingCharge: 50, minOrderForFreeShipping: 1000 };
        
        setPromocodes(localPromos);
        setBanners(localBanners);
        setAppSettings(localSettings);
        setOrders(localOrders);
        setFeedback(localFeedback);

        // If never initialized, add some defaults
        if (localBanners.length === 0 && bannerRaw === null) {
          const defaultBanners = [
            { id: 'b1', title: 'Organic Freshness', subtitle: 'From Farm to Table', imageUrl: 'https://picsum.photos/seed/organic1/1920/1080', isActive: true, createdAt: Date.now() },
            { id: 'b2', title: 'Seasonal Harvest', subtitle: 'Get the best of this season', imageUrl: 'https://picsum.photos/seed/organic2/1920/1080', isActive: true, createdAt: Date.now() }
          ];
          localStorage.setItem('demo_banners', JSON.stringify(defaultBanners));
          setBanners(defaultBanners);
        }

        // Demo Customers
        const localUsers = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('demo_profile_')) {
            localUsers.push(JSON.parse(localStorage.getItem(key)!));
          }
        }
        setCustomers(localUsers);

        // If never initialized, add some defaults
        if (localProducts === null) {
          const defaults = [
            { id: '1', name: 'Organic Avocados', description: 'Creamy avocados harvested from local sustainable farms.', price: 499, stock: 50, category: 'Vegetables', createdAt: Date.now() },
            { id: '2', name: 'Fresh Strawberries', description: 'Sweet and juicy organic strawberries.', price: 650, stock: 30, category: 'Fruits', createdAt: Date.now() }
          ];
          localStorage.setItem('demo_products', JSON.stringify(defaults));
          setProducts(defaults);
        } else {
          setProducts(localProducts);
        }

        if (localCategories === null) {
          const defaultCategories = [
            { id: '1', name: 'Vegetables', createdAt: Date.now() },
            { id: '2', name: 'Fruits', createdAt: Date.now() },
            { id: '3', name: 'Bakery', createdAt: Date.now() },
            { id: '4', name: 'Pantry', createdAt: Date.now() },
            { id: '5', name: 'Dairy', createdAt: Date.now() }
          ];
          localStorage.setItem('demo_categories', JSON.stringify(defaultCategories));
          setCategories(defaultCategories);
          if (!newProduct.category) setNewProduct(prev => ({ ...prev, category: 'Vegetables' }));
        } else {
          setCategories(localCategories);
          if (!newProduct.category && localCategories.length > 0) {
            setNewProduct(prev => ({ ...prev, category: localCategories[0].name }));
          }
        }

        setOrders(localOrders);
        setFeedback(localFeedback);
      }
      
      // Fetch Razorpay config status
      setRazorpayLoading(true);
      setRazorpayError(null);
      try {
        const rzpRes = await fetch(`${apiBase}/api/razorpay-config-check`);
        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          setRazorpayConfig(rzpData);
        } else {
          setRazorpayError(`Backend returned ${rzpRes.status}: ${rzpRes.statusText}`);
        }
      } catch (e: any) {
        console.error("Failed to fetch Razorpay config status:", e);
        setRazorpayError(`Connection failed: ${e.message || 'Unknown error'}`);
      } finally {
        setRazorpayLoading(false);
      }
    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      setFetchError(error.message || "Failed to fetch data from database.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("Image selected:", file?.name, file?.size, file?.type);
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File, folder: string = 'products'): Promise<string> => {
    if (!isFirebaseConfigured) {
      console.log("Demo Mode: Using image preview for", folder);
      return imagePreview || '';
    }
    
    try {
      console.log(`Firebase Mode: Uploading to ${folder}/${Date.now()}_${file.name}...`);
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      console.log("Upload success, URL:", url);
      return url;
    } catch (error: any) {
      console.error(`Error uploading image to ${folder}:`, error);
      throw new Error(`Failed to upload image to ${folder}. ${error.message || "Please check your Firebase Storage rules."}`);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const productData = {
        ...newProduct,
        image: imageUrl,
        createdAt: Date.now()
      };

      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'products'), productData);
      } else {
        // Demo Mode
        const localProducts = JSON.parse(localStorage.getItem('demo_products') || '[]');
        const newProd = { ...productData, id: Math.random().toString(36).substr(2, 9) };
        const updated = [...localProducts, newProd];
        localStorage.setItem('demo_products', JSON.stringify(updated));
      }

      setIsAdding(false);
      setNewProduct({ name: '', description: '', price: 0, stock: 0, category: 'Vegetables', image: '' });
      setSelectedImage(null);
      setImagePreview(null);
      fetchData(isDemoAdmin);
    } catch (error: any) {
      console.error("Error adding product:", error);
      alert("Failed to add product: " + (error.message || "Unknown error"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    console.log("Attempting to delete product with ID:", id);
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      if (isFirebaseConfigured) {
        console.log("Deleting from Firebase...");
        await deleteDoc(doc(db, 'products', id));
      } else {
        // Demo Mode
        console.log("Deleting from LocalStorage...");
        const localProducts = JSON.parse(localStorage.getItem('demo_products') || '[]');
        const updated = localProducts.filter((p: any) => p.id !== id);
        localStorage.setItem('demo_products', JSON.stringify(updated));
      }
      await fetchData(isDemoAdmin);
      console.log("Product deleted and data refreshed.");
    } catch (error: any) {
      console.error("Error deleting product:", error);
      if (error.code === 'permission-denied') {
        alert("Firebase Permission Denied: You don't have permission to delete products. Check your Firestore rules.");
      } else {
        alert("Failed to delete product: " + (error.message || "Unknown error"));
      }
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const categoryData = {
        name: newCategoryName.trim(),
        createdAt: Date.now()
      };

      if (isFirebaseConfigured && !isDemoAdmin) {
        await addDoc(collection(db, 'categories'), categoryData);
      } else {
        const localCategories = JSON.parse(localStorage.getItem('demo_categories') || '[]');
        const newCat = { ...categoryData, id: Math.random().toString(36).substr(2, 9) };
        const updated = [...localCategories, newCat];
        localStorage.setItem('demo_categories', JSON.stringify(updated));
      }

      setNewCategoryName('');
      setIsAddingCategory(false);
      fetchData(isDemoAdmin);
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...newPromo, createdAt: Date.now() };
      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'promocodes'), data);
      } else {
        const local = JSON.parse(localStorage.getItem('demo_promocodes') || '[]');
        const updated = [...local, { ...data, id: Math.random().toString(36).substr(2, 9) }];
        localStorage.setItem('demo_promocodes', JSON.stringify(updated));
      }
      setIsAddingPromo(false);
      setNewPromo({ code: '', discountType: 'percentage', discountValue: 0, minOrderAmount: 0, isActive: true });
      fetchData(isDemoAdmin);
    } catch (error) { console.error(error); }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleAddBanner started", { 
      selectedImage: !!selectedImage, 
      imagePreview: !!imagePreview, 
      isFirebaseConfigured 
    });

    if (!selectedImage && !imagePreview) {
      alert("Please select an image for the banner.");
      return;
    }
    
    setIsUploading(true);
    try {
      let imageUrl = '';
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage, 'banners');
      } else if (imagePreview) {
        imageUrl = imagePreview;
      }

      if (!imageUrl) {
        throw new Error("Image is required for the banner.");
      }

      console.log("Adding banner data:", { ...newBanner, imageUrl });

      const data = { ...newBanner, imageUrl, createdAt: Date.now() };
      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'banners'), data);
      } else {
        const local = JSON.parse(localStorage.getItem('demo_banners') || '[]');
        const updated = [...local, { ...data, id: Math.random().toString(36).substr(2, 9) }];
        localStorage.setItem('demo_banners', JSON.stringify(updated));
      }
      alert("Banner added successfully!");
      setIsAddingBanner(false);
      setNewBanner({ title: '', subtitle: '', link: '', isActive: true });
      setSelectedImage(null);
      setImagePreview(null);
      fetchData(isDemoAdmin);
    } catch (error: any) { 
      console.error("Banner add error:", error);
      alert("Failed to add banner: " + (error.message || "Unknown error"));
    }
    finally { setIsUploading(false); }
  };

  const updateSettings = async () => {
    try {
      if (isFirebaseConfigured) {
        await setDoc(doc(db, 'settings', 'app'), appSettings);
      } else {
        localStorage.setItem('demo_settings', JSON.stringify(appSettings));
      }
      alert("Settings updated successfully!");
    } catch (error) { console.error(error); }
  };

  const exportToExcel = () => {
    const data = orders.map(order => ({
      ID: order.id,
      Date: format(order.createdAt, 'yyyy-MM-dd HH:mm'),
      Customer: order.customerName,
      Email: order.customerEmail,
      Items: order.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
      Subtotal: order.subtotal,
      Discount: order.discount,
      Shipping: order.shipping,
      Total: order.total,
      Status: order.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Selling Report");
    XLSX.writeFile(wb, `Selling_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Selling Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${format(new Date(), 'PPpp')}`, 14, 22);
      
      const tableData = orders.map(order => [
        format(order.createdAt, 'MMM dd, yyyy'),
        order.customerName || 'N/A',
        order.items.map(i => i.name).join(', '),
        `Rs.${(order.total || 0).toFixed(2)}`,
        order.status || 'pending',
        order.paymentMethod === 'online' ? 'Online' : 'COD'
      ]);
      
      // Use the autoTable plugin
      (doc as any).autoTable({
        head: [['Date', 'Customer', 'Products', 'Total', 'Status', 'Payment']],
        body: tableData,
        startY: 30,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [46, 125, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 30 }
      });
      
      doc.save(`Selling_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error: any) {
      console.error("PDF Export Error:", error);
      alert("Failed to generate PDF: " + (error.message || "Unknown error"));
    }
  };

  const exportCustomersToExcel = () => {
    const data = customers.map(c => ({
      Name: c.name || 'N/A',
      Email: c.email,
      Mobile: c.mobile || 'N/A',
      Joined: c.createdAt ? format(c.createdAt, 'yyyy-MM-dd') : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `Customer_List_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportCustomersToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Customer List", 14, 15);
      
      const tableData = customers.map(c => [
        c.name || 'N/A',
        c.email,
        c.mobile || 'N/A',
        c.createdAt ? format(c.createdAt, 'MMM dd, yyyy') : 'N/A'
      ]);
      
      (doc as any).autoTable({
        head: [['Name', 'Email', 'Mobile', 'Joined Date']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [46, 125, 50] }
      });
      
      doc.save(`Customer_List_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error: any) {
      alert("Failed to generate PDF");
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !newCategoryName.trim()) return;

    try {
      if (isFirebaseConfigured) {
        await updateDoc(doc(db, 'categories', editingCategory.id), { name: newCategoryName.trim() });
      } else {
        const localCategories = JSON.parse(localStorage.getItem('demo_categories') || '[]');
        const updated = localCategories.map((c: any) => c.id === editingCategory.id ? { ...c, name: newCategoryName.trim() } : c);
        localStorage.setItem('demo_categories', JSON.stringify(updated));
      }

      setNewCategoryName('');
      setEditingCategory(null);
      fetchData(isDemoAdmin);
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Products in this category will remain but their category label might become outdated.')) return;
    try {
      if (isFirebaseConfigured) {
        await deleteDoc(doc(db, 'categories', id));
      } else {
        const localCategories = JSON.parse(localStorage.getItem('demo_categories') || '[]');
        const updated = localCategories.filter((c: any) => c.id !== id);
        localStorage.setItem('demo_categories', JSON.stringify(updated));
      }
      fetchData(isDemoAdmin);
    } catch (error: any) {
      console.error("Error deleting category:", error);
      if (error.code === 'permission-denied') {
        alert("Firebase Permission Denied: You don't have permission to delete categories. Check your Firestore rules.");
      } else {
        alert("Failed to delete category: " + (error.message || "Unknown error"));
      }
    }
  };

  const totalSales = orders.reduce((acc, order) => acc + order.total, 0);
  const totalOrders = orders.length;
  const lowStockProducts = products.filter(p => p.stock < (appSettings.lowStockThreshold || 10));

  // Chart data
  const salesByDate = orders.reduce((acc: any[], order) => {
    const date = format(order.createdAt, 'MMM dd');
    const existing = acc.find(i => i.date === date);
    if (existing) {
      existing.amount += order.total;
    } else {
      acc.push({ date, amount: order.total });
    }
    return acc;
  }, []).reverse();

  return (
    <>
      {isAuthChecking ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-organic-green" size={48} />
          <p className="text-stone-400 font-bold">Verifying Admin Access...</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar */}
      <aside className="lg:w-64 space-y-2">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <LayoutDashboard size={20} /> Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'products' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <Package size={20} /> Products
        </button>
        <button 
          onClick={() => setActiveTab('sales')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'sales' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <ShoppingBag size={20} /> Orders
        </button>
        <button 
          onClick={() => setActiveTab('stock')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'stock' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <BarChart3 size={20} /> Stock Report
        </button>
        <button 
          onClick={() => setActiveTab('feedback')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'feedback' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <MessageSquare size={20} /> User Feedback
        </button>
        <button 
          onClick={() => setActiveTab('customers')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'customers' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <User size={20} /> Customers
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'categories' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <Tags size={20} /> Categories
        </button>
        <button 
          onClick={() => setActiveTab('promocodes')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'promocodes' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <Ticket size={20} /> Promo Codes
        </button>
        <button 
          onClick={() => setActiveTab('banners')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'banners' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <BannerIcon size={20} /> Banners
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'settings' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <Sliders size={20} /> Settings
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${activeTab === 'security' ? 'bg-organic-green text-white shadow-lg shadow-organic-green/20' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
        >
          <Lock size={20} /> Security
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-grow space-y-8">
        {!isFirebaseConfigured && (
          <div className="space-y-4">
            <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
              <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
                <Database className="text-organic-green" size={24} />
                Firebase Database Connection
              </h3>
              <div className="space-y-4 text-sm text-stone-600">
                <p>
                  Firebase has been automatically provisioned for your <strong>Organic Products Store</strong>. 
                  Your data is now being stored securely in the cloud.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a 
                    href="https://console.firebase.google.com/project/organic-products-store/firestore/databases/ai-studio-3b49ad32-9809-4584-a511-c98a9ad18642/data" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold transition-colors"
                  >
                    <Database size={16} /> View Firestore Database
                  </a>
                  <button 
                    onClick={testConnection}
                    disabled={testStatus === 'testing'}
                    className="flex items-center gap-2 px-4 py-2 bg-organic-green text-white hover:bg-organic-green/90 rounded-xl font-bold transition-colors disabled:opacity-50"
                  >
                    {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Test Connection
                  </button>
                </div>
                
                {testStatus === 'success' && (
                  <p className="text-emerald-600 font-bold flex items-center gap-2">
                    <Plus size={16} className="rotate-45" /> Connection successful!
                  </p>
                )}
                
                {testStatus === 'error' && (
                  <p className="text-rose-600 font-bold flex items-center gap-2">
                    <AlertCircle size={16} /> {testError}
                  </p>
                )}

                {(localOrdersCount > 0 || localProductsCount > 0) && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="font-bold text-amber-800 mb-2">Local Data Found!</p>
                    <p className="mb-4">You have {localProductsCount} products and {localOrdersCount} orders in your local browser storage from Demo Mode.</p>
                    <button 
                      onClick={migrateData}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-bold transition-colors"
                    >
                      <ArrowRight size={16} /> Migrate to Firebase
                    </button>
                  </div>
                )}

                {isFirebaseConfigured && products.length === 0 && (
                  <div className="mt-6 p-6 bg-organic-green/5 border border-organic-green/10 rounded-[32px]">
                    <h4 className="font-bold text-organic-green mb-2 flex items-center gap-2">
                      <Package size={18} /> Empty Database?
                    </h4>
                    <p className="text-sm text-stone-600 mb-4">
                      Your live database is currently empty. You can add products manually or seed it with some default organic products to get started quickly.
                    </p>
                    <button 
                      onClick={seedData}
                      className="flex items-center gap-2 px-6 py-3 bg-organic-green text-white hover:bg-stone-800 rounded-2xl font-bold transition-all shadow-lg shadow-organic-green/20"
                    >
                      <Database size={18} /> Seed Default Data
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {fetchError && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between text-red-700">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">
                <strong>Error:</strong> {fetchError}
              </p>
            </div>
            <button 
              onClick={() => fetchData()}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-xl text-xs font-bold transition-all"
            >
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-organic-green" size={48} />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-3xl font-serif font-bold">Dashboard Overview</h3>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${isFirebaseConfigured ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${isFirebaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isFirebaseConfigured ? 'Live Database' : 'Demo Mode'}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-[32px] shadow-sm">
                    <p className="text-stone-400 text-sm font-bold uppercase tracking-widest mb-2">Total Sales</p>
                    <h3 className="text-4xl font-serif font-bold">₹{totalSales.toFixed(2)}</h3>
                  </div>
                  <div 
                    onClick={() => setActiveTab('sales')}
                    className="bg-white p-8 rounded-[32px] shadow-sm relative overflow-hidden cursor-pointer hover:bg-stone-50 transition-colors group"
                  >
                    <p className="text-stone-400 text-sm font-bold uppercase tracking-widest mb-2 group-hover:text-organic-green transition-colors">Total Orders</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-4xl font-serif font-bold">{totalOrders}</h3>
                      <span className="text-xs font-bold text-organic-green group-hover:underline flex items-center gap-1">
                        View All <ArrowRight size={12} />
                      </span>
                    </div>
                    {isFirebaseConfigured && localOrdersCount > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1">
                          <Database size={12} /> {localOrdersCount} local orders found
                        </p>
                        <button 
                          onClick={migrateData}
                          className="text-[10px] text-amber-800 underline font-bold mt-1 hover:text-amber-900"
                        >
                          Migrate to Firebase
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="bg-white p-8 rounded-[32px] shadow-sm">
                    <p className="text-stone-400 text-sm font-bold uppercase tracking-widest mb-2">Low Stock</p>
                    <h3 className="text-4xl font-serif font-bold text-red-500">{lowStockProducts.length}</h3>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[32px] shadow-sm">
                  <h3 className="text-2xl font-serif font-bold mb-8">Sales Overview</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesByDate}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#5A5A40" strokeWidth={4} dot={{ r: 6, fill: '#5A5A40' }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[32px] shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-serif font-bold">Recent Orders</h3>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => fetchData(isDemoAdmin)}
                        className="text-stone-400 hover:text-organic-green transition-colors flex items-center gap-1 text-sm font-bold"
                        title="Refresh Data"
                      >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                      <button 
                        onClick={() => setActiveTab('sales')}
                        className="text-organic-green font-bold text-sm hover:underline"
                      >
                        View All Reports
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {orders.slice(0, 5).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                        <div>
                          <p className="font-bold">{order.customerName}</p>
                          <p className="text-xs text-stone-400">{format(order.createdAt, 'MMM dd, HH:mm')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-organic-green">₹{(order.total || 0).toFixed(2)}</p>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{order.status}</p>
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-12 space-y-4">
                        <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-300">
                          <ShoppingBag size={32} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-stone-500 font-bold">No orders found yet.</p>
                          <p className="text-xs text-stone-400 max-w-xs mx-auto">
                            {isFirebaseConfigured 
                              ? "If you've placed orders on mobile, ensure your mobile app is correctly connected to Firebase."
                              : "You are in Demo Mode. Place an order in the store to see it here."}
                          </p>
                        </div>
                        {isDemoAdmin && (
                          <button 
                            onClick={() => navigate('/')}
                            className="text-organic-green text-sm font-bold hover:underline"
                          >
                            Go to Store to place a test order
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="text-3xl font-serif font-bold">Product Management</h3>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${isFirebaseConfigured ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      <div className={`w-2 h-2 rounded-full ${isFirebaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                      {isFirebaseConfigured ? 'Connected to Firebase' : 'Demo Mode (Local)'}
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="bg-organic-green text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
                  >
                    <Plus size={20} /> Add Product
                  </button>
                </div>

                {isAdding && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-[32px] shadow-xl border border-organic-green/10"
                  >
                    <form onSubmit={handleAddProduct} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Image Upload */}
                        <div className="space-y-4">
                          <label className="block text-sm font-bold text-stone-500 mb-2">Product Image</label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-3xl bg-stone-50 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-100 transition-all overflow-hidden relative group"
                          >
                            {imagePreview ? (
                              <>
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Camera className="text-white" size={32} />
                                </div>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImage(null);
                                    setImagePreview(null);
                                  }}
                                  className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg text-red-500 hover:scale-110 transition-transform"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-stone-300 mb-2 shadow-sm">
                                  <ImageIcon size={32} />
                                </div>
                                <p className="text-xs font-bold text-stone-400">Click to upload</p>
                              </>
                            )}
                          </div>
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            className="hidden"
                          />
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-bold text-stone-500 mb-2">Product Name</label>
                            <input 
                              required
                              type="text" 
                              className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                              value={newProduct.name}
                              onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-stone-500 mb-2">Category</label>
                            <select 
                              className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                              value={newProduct.category}
                              onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                            >
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-bold text-stone-500 mb-2">Price (₹)</label>
                              <input 
                                required
                                type="number" 
                                step="0.01"
                                className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                                value={newProduct.price}
                                onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold text-stone-500 mb-2">Stock</label>
                              <input 
                                required
                                type="number" 
                                className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                                value={newProduct.stock}
                                onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-stone-500 mb-2">Description</label>
                            <textarea 
                              required
                              rows={2}
                              className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                              value={newProduct.description}
                              onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button 
                          type="submit"
                          disabled={isUploading}
                          className="flex-grow bg-organic-green text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="animate-spin" size={20} />
                              Uploading...
                            </>
                          ) : 'Save Product'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIsAdding(false)}
                          className="px-8 py-4 rounded-2xl font-bold bg-stone-100 text-stone-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 font-serif text-lg">Product</th>
                        <th className="px-8 py-6 font-serif text-lg">Category</th>
                        <th className="px-8 py-6 font-serif text-lg">Price</th>
                        <th className="px-8 py-6 font-serif text-lg">Stock</th>
                        <th className="px-8 py-6 font-serif text-lg">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {products.map(product => (
                        <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
                                {product.image ? (
                                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                                    <ImageIcon size={20} />
                                  </div>
                                )}
                              </div>
                              <span className="font-bold">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-stone-500">{product.category}</td>
                          <td className="px-8 py-6 font-bold">₹{(product.price || 0).toFixed(2)}</td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {product.stock} units
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <button 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-serif font-bold">Orders & Sales</h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => fetchData(isDemoAdmin)}
                      className="bg-white text-stone-600 border border-stone-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-stone-50 transition-all text-sm"
                    >
                      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                    <button 
                      onClick={exportToExcel}
                      className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all text-sm"
                    >
                      <Download size={16} /> Excel
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all text-sm"
                    >
                      <Download size={16} /> PDF
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 font-serif text-lg">Date</th>
                        <th className="px-8 py-6 font-serif text-lg">Customer</th>
                        <th className="px-8 py-6 font-serif text-lg">Items</th>
                        <th className="px-8 py-6 font-serif text-lg">Total</th>
                        <th className="px-8 py-6 font-serif text-lg">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {orders.length > 0 ? orders.map(order => (
                        <tr key={order.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-8 py-6 text-stone-500">{format(order.createdAt, 'MMM dd, yyyy')}</td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-bold">{order.customerName}</span>
                              <span className="text-xs text-stone-400">{order.customerEmail}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-stone-500">
                            <div className="flex flex-col gap-1">
                              {order.items.map((item, idx) => (
                                <span key={idx} className="text-xs">
                                  {item.name} <span className="text-stone-400">x{item.quantity}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-8 py-6 font-bold">₹{order.total.toFixed(2)}</td>
                          <td className="px-8 py-6">
                            <select 
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                              className={`px-3 py-1 rounded-full text-xs font-bold border-none cursor-pointer transition-colors ${
                                order.status === 'completed' ? 'bg-green-100 text-green-600' : 
                                order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 
                                'bg-blue-100 text-blue-600'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center">
                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-300">
                                <ShoppingBag size={32} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-stone-500 font-bold">No orders found.</p>
                                <p className="text-xs text-stone-400 max-w-xs mx-auto">
                                  {isFirebaseConfigured 
                                    ? "If you've placed orders on mobile, ensure your mobile app is correctly connected to Firebase."
                                    : "You are in Demo Mode. Place an order in the store to see it here."}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'stock' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-serif font-bold">Stock Report</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {products.map(product => (
                    <div key={product.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-stone-100">
                      <div className="mb-4">
                        <h4 className="font-bold">{product.name}</h4>
                        <p className="text-xs text-stone-400 uppercase tracking-widest">{product.category}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-500">Current Stock</span>
                          <span className={`font-bold ${(product.stock || 0) < 10 ? 'text-red-500' : 'text-stone-900'}`}>{product.stock || 0}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${(product.stock || 0) < 10 ? 'bg-red-500' : 'bg-organic-green'}`}
                            style={{ width: `${Math.min(100, ((product.stock || 0) / 100) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-serif font-bold">User Feedback</h3>
                <div className="grid grid-cols-1 gap-6">
                  {feedback.length === 0 ? (
                    <div className="bg-white p-12 rounded-[48px] text-center border border-stone-100">
                      <MessageSquare className="mx-auto text-stone-200 mb-4" size={48} />
                      <p className="text-stone-400 font-bold">No feedback received yet.</p>
                    </div>
                  ) : (
                    feedback.map((item: any) => (
                      <div key={item.id} className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-stone-900">{item.email}</h4>
                            <p className="text-xs text-stone-400">{format(item.createdAt, 'PPpp')}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${item.status === 'new' ? 'bg-organic-green/10 text-organic-green' : 'bg-stone-100 text-stone-400'}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-stone-600 leading-relaxed">{item.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-serif font-bold">Manage Categories</h3>
                  <button 
                    onClick={() => {
                      setIsAddingCategory(true);
                      setEditingCategory(null);
                      setNewCategoryName('');
                    }}
                    className="bg-organic-green text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-800 transition-all"
                  >
                    <Plus size={20} /> Add Category
                  </button>
                </div>

                {(isAddingCategory || editingCategory) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm"
                  >
                    <form onSubmit={editingCategory ? handleUpdateCategory : handleAddCategory} className="flex gap-4 items-end">
                      <div className="flex-grow">
                        <label className="block text-sm font-bold text-stone-500 mb-2">Category Name</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="e.g. Beverages"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="submit"
                          className="bg-organic-green text-white px-8 py-4 rounded-2xl font-bold"
                        >
                          {editingCategory ? 'Update' : 'Save'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setIsAddingCategory(false);
                            setEditingCategory(null);
                            setNewCategoryName('');
                          }}
                          className="px-8 py-4 rounded-2xl font-bold bg-stone-100 text-stone-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 font-serif text-lg">Category Name</th>
                        <th className="px-8 py-6 font-serif text-lg">Created At</th>
                        <th className="px-8 py-6 font-serif text-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {categories.map(cat => (
                        <tr key={cat.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <span className="font-bold">{cat.name}</span>
                          </td>
                          <td className="px-8 py-6 text-stone-500">
                            {format(cat.createdAt, 'PP')}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setNewCategoryName(cat.name);
                                  setIsAddingCategory(false);
                                }}
                                className="p-2 text-stone-400 hover:text-organic-green transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'promocodes' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-serif font-bold">Promo Codes</h3>
                  <button 
                    onClick={() => setIsAddingPromo(true)}
                    className="bg-organic-green text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"
                  >
                    <Plus size={20} /> Add Promo Code
                  </button>
                </div>

                {isAddingPromo && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100">
                    <form onSubmit={handleAddPromo} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">Code</label>
                        <input required type="text" className="w-full p-4 rounded-2xl bg-stone-50 border-none" value={newPromo.code} onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} placeholder="E.G. ORGANIC20" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">Type</label>
                        <select className="w-full p-4 rounded-2xl bg-stone-50 border-none" value={newPromo.discountType} onChange={e => setNewPromo({...newPromo, discountType: e.target.value as any})}>
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">Value</label>
                        <input required type="number" className="w-full p-4 rounded-2xl bg-stone-50 border-none" value={newPromo.discountValue} onChange={e => setNewPromo({...newPromo, discountValue: Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">Min Order Amount</label>
                        <input required type="number" className="w-full p-4 rounded-2xl bg-stone-50 border-none" value={newPromo.minOrderAmount} onChange={e => setNewPromo({...newPromo, minOrderAmount: Number(e.target.value)})} />
                      </div>
                      <div className="flex items-end gap-4">
                        <button type="submit" className="flex-grow bg-organic-green text-white p-4 rounded-2xl font-bold">Save Code</button>
                        <button type="button" onClick={() => setIsAddingPromo(false)} className="p-4 rounded-2xl bg-stone-100 text-stone-600 font-bold">Cancel</button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-8 py-6 font-serif text-lg">Code</th>
                        <th className="px-8 py-6 font-serif text-lg">Discount</th>
                        <th className="px-8 py-6 font-serif text-lg">Min Order</th>
                        <th className="px-8 py-6 font-serif text-lg">Status</th>
                        <th className="px-8 py-6 font-serif text-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {promocodes.map(promo => (
                        <tr key={promo.id}>
                          <td className="px-8 py-6 font-bold">{promo.code}</td>
                          <td className="px-8 py-6">{promo.discountType === 'percentage' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}</td>
                          <td className="px-8 py-6">₹{promo.minOrderAmount}</td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${promo.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {promo.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={async () => {
                              if (isFirebaseConfigured) await deleteDoc(doc(db, 'promocodes', promo.id));
                              else {
                                const local = promocodes.filter(p => p.id !== promo.id);
                                localStorage.setItem('demo_promocodes', JSON.stringify(local));
                              }
                              fetchData(isDemoAdmin);
                            }} className="text-red-500"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-serif font-bold">Registered Customers</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={exportCustomersToExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                    >
                      <Download size={18} /> Excel
                    </button>
                    <button 
                      onClick={exportCustomersToPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                    >
                      <Download size={18} /> PDF
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-stone-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100">
                        <th className="p-6 font-serif font-bold text-stone-600">Name</th>
                        <th className="p-6 font-serif font-bold text-stone-600">Email</th>
                        <th className="p-6 font-serif font-bold text-stone-600">Mobile</th>
                        <th className="p-6 font-serif font-bold text-stone-600">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-stone-400 font-bold">No customers found.</td>
                        </tr>
                      ) : (
                        customers.map((customer, idx) => (
                          <tr key={idx} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                            <td className="p-6 font-bold text-stone-900">{customer.name || 'N/A'}</td>
                            <td className="p-6 text-stone-500">{customer.email}</td>
                            <td className="p-6 text-stone-500">{customer.mobile || 'N/A'}</td>
                            <td className="p-6 text-stone-400 text-sm">
                              {customer.createdAt ? format(customer.createdAt, 'PP') : 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'banners' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-serif font-bold">Home Page Banners</h3>
                  <button onClick={() => setIsAddingBanner(true)} className="bg-organic-green text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
                    <Plus size={20} /> Add Banner
                  </button>
                </div>

                {isAddingBanner && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100">
                    <form onSubmit={handleAddBanner} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">Title</label>
                        <input required type="text" className="w-full p-4 rounded-2xl bg-stone-50 border-none" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-stone-500 mb-2">Subtitle</label>
                        <input required type="text" className="w-full p-4 rounded-2xl bg-stone-50 border-none" value={newBanner.subtitle} onChange={e => setNewBanner({...newBanner, subtitle: e.target.value})} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-stone-500 mb-2">Banner Image</label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-stone-200 rounded-3xl p-8 text-center cursor-pointer hover:border-organic-green transition-colors bg-stone-50"
                        >
                          {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-xl" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-stone-400">
                              <Camera size={48} />
                              <p className="font-bold">Click to upload banner image</p>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                      </div>
                      <div className="flex items-end gap-4 md:col-span-2">
                        <button type="submit" disabled={isUploading} className="flex-grow bg-organic-green text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                          {isUploading ? <Loader2 className="animate-spin" /> : 'Save Banner'}
                        </button>
                        <button type="button" onClick={() => setIsAddingBanner(false)} className="p-4 rounded-2xl bg-stone-100 text-stone-600 font-bold">Cancel</button>
                      </div>
                    </form>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {banners.map(banner => (
                    <div key={banner.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-stone-100 group relative">
                      <img src={banner.imageUrl} alt={banner.title} className="w-full h-48 object-cover" />
                      <div className="p-6">
                        <h4 className="font-bold text-xl">{banner.title}</h4>
                        <p className="text-stone-500 text-sm">{banner.subtitle}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          if (isFirebaseConfigured) await deleteDoc(doc(db, 'banners', banner.id));
                          else {
                            const local = banners.filter(b => b.id !== banner.id);
                            localStorage.setItem('demo_banners', JSON.stringify(local));
                          }
                          fetchData(isDemoAdmin);
                        }}
                        className="absolute top-4 right-4 p-2 bg-white/90 rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-serif font-bold">Store Settings</h3>

                {/* Razorpay Configuration Status */}
                <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm max-w-2xl">
                  <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                    <Database className="text-organic-green" size={24} />
                    Payment Gateway Status (Razorpay)
                  </h3>
                  
                  {razorpayLoading ? (
                    <div className="flex items-center gap-3 text-stone-500 py-4">
                      <RefreshCw className="animate-spin" size={20} />
                      <span>Checking backend configuration...</span>
                    </div>
                  ) : razorpayError ? (
                    <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-rose-800 mb-6">
                      <p className="font-bold mb-2 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Connection Error
                      </p>
                      <p className="text-sm mb-4">The website could not reach the backend server to verify configuration.</p>
                      <div className="bg-white/50 p-3 rounded-xl border border-rose-100 font-mono text-xs mb-4">
                        {razorpayError}
                      </div>
                      <p className="text-xs opacity-80">This usually means the backend server at <b>{apiBase || 'Local Server'}</b> is not running or is blocked by CORS/Authentication.</p>
                      
                      <div className="mt-4 pt-4 border-t border-rose-100">
                        <p className="text-xs font-bold mb-2 uppercase tracking-wider">Troubleshooting:</p>
                        <ol className="list-decimal pl-4 space-y-1 text-xs opacity-80">
                          <li>Ensure the backend server is running in AI Studio.</li>
                          <li>If using the live site, ensure the "Shared App URL" is correct.</li>
                          <li>You can manually override the backend URL below if needed.</li>
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className={`p-4 rounded-2xl border ${razorpayConfig?.key_id_set ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Key ID Status</span>
                            {razorpayConfig?.key_id_set ? <Plus size={20} className="rotate-45" /> : <AlertCircle size={20} />}
                          </div>
                          <p className="text-sm mt-1">{razorpayConfig?.key_id_set ? 'Configured' : 'Missing (RAZORPAY_KEY_ID)'}</p>
                          {razorpayConfig?.key_id_set && (
                            <p className="text-[10px] opacity-60 mt-1">Length: {razorpayConfig.key_id_length} chars</p>
                          )}
                          {razorpayConfig?.key_id_prefix && (
                            <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${razorpayConfig.key_id_prefix.startsWith('rzp_live') ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                              {razorpayConfig.key_id_prefix.startsWith('rzp_live') ? 'Live Mode' : 'Test Mode'} ({razorpayConfig.key_id_prefix}...)
                            </div>
                          )}
                        </div>
                        
                        <div className={`p-4 rounded-2xl border ${razorpayConfig?.key_secret_set ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Key Secret Status</span>
                            {razorpayConfig?.key_secret_set ? <Plus size={20} className="rotate-45" /> : <AlertCircle size={20} />}
                          </div>
                          <p className="text-sm mt-1">{razorpayConfig?.key_secret_set ? 'Configured' : 'Missing (RAZORPAY_KEY_SECRET)'}</p>
                          {razorpayConfig?.key_secret_set && (
                            <p className="text-[10px] opacity-60 mt-1">Length: {razorpayConfig.key_secret_length} chars</p>
                          )}
                        </div>
                      </div>

                      {!razorpayConfig?.key_id_set || !razorpayConfig?.key_secret_set ? (
                        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-amber-800">
                          <p className="font-bold mb-3 flex items-center gap-2">
                            <AlertCircle size={18} />
                            Action Required: Configuration Missing
                          </p>
                          <p className="text-sm mb-4">The backend server is missing the required Razorpay API keys. Follow these steps to fix it:</p>
                          <ol className="list-decimal pl-5 space-y-3 text-sm">
                            <li>
                              <strong>Open Settings:</strong> Click the <b>Settings</b> (⚙️ Gear icon) in the top right corner of the AI Studio chat window.
                            </li>
                            <li>
                              <strong>Go to Secrets:</strong> Select the <b>Secrets</b> tab in the settings panel.
                            </li>
                            <li>
                              <strong>Add Key ID:</strong> Add a new secret named <code>RAZORPAY_KEY_ID</code> and paste your Razorpay Key ID (e.g., <code>rzp_live_...</code>).
                            </li>
                            <li>
                              <strong>Add Key Secret:</strong> Add a new secret named <code>RAZORPAY_KEY_SECRET</code> and paste your Razorpay Key Secret.
                            </li>
                            <li>
                              <strong>Wait for Reload:</strong> The application will automatically restart and pick up the new keys.
                            </li>
                          </ol>
                          <div className="mt-4 p-3 bg-white/50 rounded-xl border border-amber-200 text-xs italic">
                            Note: If you have already added these to the <code>.env</code> file, ensure the server has been restarted.
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-emerald-800">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="bg-emerald-500 text-white p-1 rounded-full">
                              <Plus size={16} className="rotate-45" />
                            </div>
                            <p className="font-bold">Razorpay is correctly configured!</p>
                          </div>
                          <p className="text-sm opacity-90">The backend server has successfully loaded your Razorpay credentials.</p>
                          
                          <div className="mt-4 pt-4 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="text-stone-500 font-bold uppercase tracking-wider mb-1">Environment</p>
                              <p className="font-mono">{razorpayConfig.key_id_prefix?.startsWith('rzp_live') ? 'PRODUCTION (LIVE)' : 'SANDBOX (TEST)'}</p>
                            </div>
                            <div>
                              <p className="text-stone-500 font-bold uppercase tracking-wider mb-1">Backend URL</p>
                              <p className="font-mono truncate" title={apiBase}>{apiBase || 'Local Server'}</p>
                            </div>
                          </div>
                          
                          <div className="mt-6">
                            <button 
                              onClick={async () => {
                                setTestStatus('testing');
                                setTestError('');
                                try {
                                  const res = await fetch(`${apiBase}/api/create-razorpay-order`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ amount: 1 }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    if (data.id) setTestStatus('success');
                                    else throw new Error("No order ID returned");
                                  } else {
                                    const err = await res.json();
                                    throw new Error(err.error || `Server error ${res.status}`);
                                  }
                                } catch (e: any) {
                                  console.error("Test order failed:", e);
                                  setTestStatus('error');
                                  setTestError(e.message || "Failed to create test order");
                                }
                              }}
                              disabled={testStatus === 'testing'}
                              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                testStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                                testStatus === 'error' ? 'bg-rose-100 text-rose-700' :
                                'bg-stone-800 text-white hover:bg-stone-700'
                              }`}
                            >
                              {testStatus === 'testing' ? <RefreshCw className="animate-spin" size={16} /> : null}
                              {testStatus === 'success' ? <CheckCircle2 size={16} /> : null}
                              {testStatus === 'error' ? <AlertCircle size={16} /> : null}
                              {testStatus === 'success' ? 'Test Order Created Successfully!' : 
                               testStatus === 'error' ? 'Test Failed' : 'Test Order Creation (₹1)'}
                            </button>
                            {testError && <p className="text-[10px] text-rose-500 mt-2 font-bold">{testError}</p>}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="mt-8 pt-8 border-t border-stone-100">
                    <h4 className="text-sm font-bold text-stone-500 mb-4 uppercase tracking-wider">Advanced: Backend URL Override</h4>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="https://your-backend-url.run.app"
                        className="flex-1 p-3 rounded-xl bg-stone-50 border-none text-xs font-mono focus:ring-2 focus:ring-organic-green"
                        value={backendUrlOverride}
                        onChange={(e) => setBackendUrlOverride(e.target.value)}
                      />
                      <button 
                        onClick={() => {
                          if (backendUrlOverride) {
                            localStorage.setItem('backend_url_override', backendUrlOverride);
                            setApiBase(backendUrlOverride);
                          } else {
                            localStorage.removeItem('backend_url_override');
                            setApiBase(API_BASE);
                          }
                          fetchData();
                        }}
                        className="bg-stone-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-700"
                      >
                        Apply
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-2 italic">
                      Use this if the automatic backend detection is incorrect. Leave empty to use default.
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => fetchData()}
                    className="mt-4 flex items-center gap-2 text-organic-green font-bold text-sm hover:underline"
                  >
                    <RefreshCw size={16} /> Refresh Status
                  </button>
                </div>

                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100 max-w-2xl">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Standard Shipping Charge (₹)</label>
                      <input 
                        type="number" 
                        className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={appSettings.shippingCharge}
                        onChange={e => setAppSettings({...appSettings, shippingCharge: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Low Stock Threshold (Units)</label>
                      <p className="text-xs text-stone-400 mb-2">Products with stock below this value will appear in the Stock Report.</p>
                      <input 
                        type="number" 
                        className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={appSettings.lowStockThreshold}
                        onChange={e => setAppSettings({...appSettings, lowStockThreshold: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Free Shipping Threshold (₹)</label>
                      <input 
                        type="number" 
                        className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={appSettings.minOrderForFreeShipping}
                        onChange={e => setAppSettings({...appSettings, minOrderForFreeShipping: Number(e.target.value)})}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <div>
                        <p className="font-bold text-stone-700">Enable Razorpay Online Payment</p>
                        <p className="text-xs text-stone-400">Allow customers to pay online using Razorpay gateway.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={appSettings.razorpayEnabled} 
                          onChange={e => setAppSettings({...appSettings, razorpayEnabled: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-organic-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-organic-green"></div>
                      </label>
                    </div>
                    <button 
                      onClick={updateSettings}
                      className="w-full bg-organic-green text-white p-4 rounded-2xl font-bold hover:bg-stone-800 transition-all"
                    >
                      Update Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-serif font-bold">Security Settings</h3>
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-stone-100 max-w-md">
                  <h4 className="text-xl font-serif font-bold mb-6">Change Admin Password</h4>
                  <form onSubmit={handlePasswordChange} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Current Password</label>
                      <input 
                        required
                        type="password" 
                        className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={passwordForm.currentPassword}
                        onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">New Password</label>
                      <input 
                        required
                        type="password" 
                        className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-500 mb-2">Confirm New Password</label>
                      <input 
                        required
                        type="password" 
                        className="w-full p-4 rounded-2xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full bg-organic-green text-white p-4 rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {passwordLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Update Password'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
        </div>
      )}
    </>
  );
}
