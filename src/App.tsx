import { useState, useMemo, Fragment, useEffect, ChangeEvent } from 'react';
import { Plus, Minus, Trash2, Printer, Save, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, CloudUpload, CloudDownload, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef } from 'react';
import { auth, signInWithGoogle, logout, saveTableToCloud, loadTableFromCloud } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Provider {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  quantity: number;
  prices: Record<string, number>; // providerId -> price
}

const STORAGE_KEY = 'hوارب_table_data';

export default function App() {
  const [providers, setProviders] = useState<Provider[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).providers;
      } catch (e) { return [{ id: 'p1', name: 'المورد 1' }]; }
    }
    return [{ id: 'p1', name: 'المورد 1' }];
  });

  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).items;
      } catch (e) { return [{ id: 'i1', name: '', quantity: 1, prices: { p1: 0 } }]; }
    }
    return [{ id: 'i1', name: '', quantity: 1, prices: { p1: 0 } }];
  });

  const [subject, setSubject] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).subject || '';
      } catch (e) { return ''; }
    }
    return '';
  });

  const [showRecommendation, setShowRecommendation] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.showRecommendation !== undefined ? parsed.showRecommendation : true;
      } catch (e) { return true; }
    }
    return true;
  });

  const [highlightBestValue, setHighlightBestValue] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.highlightBestValue !== undefined ? parsed.highlightBestValue : true;
      } catch (e) { return true; }
    }
    return true;
  });

  const [dateFormat, setDateFormat] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.dateFormat || 'DD-MM-YYYY';
      } catch (e) { return 'DD-MM-YYYY'; }
    }
    return 'DD-MM-YYYY';
  });

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: '',
    direction: null,
  });

  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const data = { providers, items, subject, showRecommendation, dateFormat, highlightBestValue };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastSaved(new Date().toLocaleTimeString('fr-FR'));
    }, 30000);

    return () => clearInterval(interval);
  }, [providers, items, subject, showRecommendation, dateFormat, highlightBestValue]);

  // Also save on window close/refresh for extra safety
  useEffect(() => {
    const handleBeforeUnload = () => {
      const data = { providers, items, subject, showRecommendation, dateFormat, highlightBestValue };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [providers, items, subject, showRecommendation, dateFormat, highlightBestValue]);

  const formatDate = (date: Date, format: string) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    switch (format) {
      case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
      case 'YYYY/MM/DD': return `${year}/${month}/${day}`;
      case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
      case 'DD-MM-YYYY':
      default: return `${day}-${month}-${year}`;
    }
  };

  const currentDate = formatDate(new Date(), dateFormat);

  // Add a new provider
  const addProvider = () => {
    const newId = `p${Date.now()}`;
    setProviders([...providers, { id: newId, name: `المورد ${providers.length + 1}` }]);
    setItems(items.map(item => ({
      ...item,
      prices: { ...item.prices, [newId]: 0 }
    })));
  };

  // Remove a provider
  const removeProvider = (id: string) => {
    if (providers.length <= 1) return;
    setProviders(providers.filter(p => p.id !== id));
    setItems(items.map(item => {
      const newPrices = { ...item.prices };
      delete newPrices[id];
      return { ...item, prices: newPrices };
    }));
  };

  const removeLastProvider = () => {
    if (providers.length <= 1) return;
    removeProvider(providers[providers.length - 1].id);
  };

  // Add a new item
  const addItem = () => {
    const newId = `i${Date.now()}`;
    const initialPrices: Record<string, number> = {};
    providers.forEach(p => initialPrices[p.id] = 0);
    setItems([...items, { id: newId, name: '', quantity: 1, prices: initialPrices }]);
  };

  // Remove an item
  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const removeLastItem = () => {
    if (items.length <= 1) return;
    setItems(items.slice(0, -1));
  };

  // Update item details
  const updateItem = (id: string, field: keyof Item, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Update price
  const updatePrice = (itemId: string, providerId: string, price: number) => {
    setItems(items.map(item => 
      item.id === itemId 
        ? { ...item, prices: { ...item.prices, [providerId]: price } } 
        : item
    ));
  };

  // Update provider name
  const updateProviderName = (id: string, name: string) => {
    setProviders(providers.map(p => p.id === id ? { ...p, name } : p));
  };

  // Calculations
  const sortedItems = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return items;

    return [...items].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (sortConfig.key === 'quantity') {
        aValue = a.quantity;
        bValue = b.quantity;
      } else if (sortConfig.key.startsWith('price_')) {
        const providerId = sortConfig.key.replace('price_', '');
        aValue = a.prices[providerId] || 0;
        bValue = b.prices[providerId] || 0;
      } else {
        return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortConfig]);

  const totals = useMemo(() => {
    const providerTotals: Record<string, number> = {};
    providers.forEach(p => {
      providerTotals[p.id] = items.reduce((acc, item) => acc + (item.quantity * (item.prices[p.id] || 0)), 0);
    });
    return providerTotals;
  }, [items, providers]);

  const bestProvider = useMemo(() => {
    let minTotal = Infinity;
    let best = null;
    providers.forEach(p => {
      const total = totals[p.id];
      if (total > 0 && total < minTotal) {
        minTotal = total;
        best = p;
      }
    });
    return best as Provider | null;
  }, [totals, providers]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const data = { providers, items, subject, showRecommendation, dateFormat };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table-data-${currentDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotification({ message: 'تم تصدير الملف بنجاح على جهازك', type: 'success' });
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.providers && data.items) {
          setProviders(data.providers);
          setItems(data.items);
          if (data.subject !== undefined) setSubject(data.subject);
          if (data.showRecommendation !== undefined) setShowRecommendation(data.showRecommendation);
          if (data.highlightBestValue !== undefined) setHighlightBestValue(data.highlightBestValue);
          if (data.dateFormat !== undefined) setDateFormat(data.dateFormat);
          setNotification({ message: 'تم تحميل البيانات من الملف بنجاح', type: 'success' });
        } else {
          throw new Error('تنسيق الملف غير صحيح');
        }
      } catch (err) {
        setNotification({ message: 'خطأ في قراءة الملف: تأكد من صحة التنسيق', type: 'error' });
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloudSave = async () => {
    if (!user) {
      setNotification({ message: 'يرجى تسجيل الدخول أولاً للحفظ في السحاب', type: 'error' });
      return;
    }

    setIsCloudLoading(true);
    try {
      const data = { providers, items, subject, showRecommendation, dateFormat };
      await saveTableToCloud(user.uid, data);
      setNotification({ message: 'تم الحفظ في السحاب بنجاح', type: 'success' });
    } catch (err) {
      setNotification({ message: 'فشل الحفظ في السحاب. حاول مرة أخرى', type: 'error' });
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleCloudLoad = async () => {
    if (!user) {
      setNotification({ message: 'يرجى تسجيل الدخول أولاً للتحميل من السحاب', type: 'error' });
      return;
    }

    setIsCloudLoading(true);
    try {
      const data = await loadTableFromCloud(user.uid);
      if (data) {
        setProviders(data.providers);
        setItems(data.items);
        if (data.subject !== undefined) setSubject(data.subject);
        if (data.showRecommendation !== undefined) setShowRecommendation(data.showRecommendation);
        if (data.highlightBestValue !== undefined) setHighlightBestValue(data.highlightBestValue);
        if (data.dateFormat !== undefined) setDateFormat(data.dateFormat);
        setNotification({ message: 'تم تحميل البيانات من السحاب بنجاح', type: 'success' });
      } else {
        setNotification({ message: 'لا توجد بيانات محفوظة لهذا المستخدم', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: 'فشل التحميل من السحاب. حاول مرة أخرى', type: 'error' });
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleAuthAction = async () => {
    if (user) {
      await logout();
      setNotification({ message: 'تم تسجيل الخروج', type: 'success' });
    } else {
      try {
        await signInWithGoogle();
        setNotification({ message: 'تم تسجيل الدخول بنجاح', type: 'success' });
      } catch (err) {
        setNotification({ message: 'فشل تسجيل الدخول', type: 'error' });
      }
    }
  };

  const toggleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-3 h-3 text-blue-600" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="w-3 h-3 text-blue-600" />;
    return <ArrowUpDown className="w-3 h-3 opacity-20" />;
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-12 font-serif text-black print:p-0" dir="rtl">
      {/* Toast Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-lg text-white font-bold text-sm flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto border border-black p-8 print:border-none print:p-4 print-container">
        
        {/* Official Header */}
        <div className="flex justify-between items-start mb-12 text-sm font-bold print:mb-6">
          <div className="text-right leading-relaxed">
            <p>الجمهورية التونسية</p>
            <p>وزارة العدل</p>
            <p>الهيئة العامة للسجون والإصلاح</p>
            <p>سجن الهوارب</p>
            <p>فرقة التصرف المالي في ميزانية /مركز الشراءات</p>
          </div>
          <div className="text-left">
            <p>الهوارب في: {currentDate}</p>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center mb-6">
          <h2 className="border border-black inline-block px-12 py-1 font-bold text-lg">جدول مقارنة أثمان</h2>
        </div>

        {/* Consultation Subject */}
        <div className="mb-8 flex items-start gap-2 text-sm font-bold">
          <span className="whitespace-nowrap pt-1">موضوع الاستشارة:</span>
          <textarea
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-transparent border-none focus:ring-0 p-0 resize-none overflow-hidden min-h-[1.5rem] leading-relaxed print:placeholder-transparent"
            placeholder="أدخل موضوع الاستشارة هنا..."
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="mb-4 flex flex-wrap gap-2 print:hidden no-print">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 p-1 rounded">
            <span className="text-[10px] font-bold px-2 text-slate-500">المواد:</span>
            <button onClick={addItem} className="bg-white border border-black px-3 py-1 text-xs hover:bg-emerald-50 flex items-center gap-1">
              <Plus className="w-3 h-3" /> إضافة
            </button>
            <button 
              onClick={removeLastItem} 
              className="bg-white border border-black px-3 py-1 text-xs hover:bg-red-50 flex items-center gap-1 disabled:opacity-30"
              disabled={items.length <= 1}
            >
              <Minus className="w-3 h-3" /> تنقيص
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 p-1 rounded">
            <span className="text-[10px] font-bold px-2 text-slate-500">الموردون:</span>
            <button onClick={addProvider} className="bg-white border border-black px-3 py-1 text-xs hover:bg-blue-50 flex items-center gap-1">
              <Plus className="w-3 h-3" /> إضافة
            </button>
            <button 
              onClick={removeLastProvider} 
              className="bg-white border border-black px-3 py-1 text-xs hover:bg-red-50 flex items-center gap-1 disabled:opacity-30"
              disabled={providers.length <= 1}
            >
              <Minus className="w-3 h-3" /> تنقيص
            </button>
          </div>

          <div className="flex-grow" />
          
          {lastSaved && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-sans ml-4">
              <Save className="w-3 h-3" />
              <span>آخر حفظ: {lastSaved}</span>
            </div>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowResetConfirm(!showResetConfirm)}
              className="bg-white border border-red-200 text-red-500 px-3 py-1 text-xs hover:bg-red-50 flex items-center gap-2 transition-colors rounded"
              title="مسح كافة البيانات والبدء من جديد"
            >
              <Trash2 className="w-3 h-3" />
              <span>مسح الكل</span>
            </button>
            
            {showResetConfirm && (
              <div className="absolute top-full right-0 mt-2 p-3 bg-white border border-red-200 shadow-xl rounded z-50 min-w-[200px] text-right">
                <p className="text-[10px] font-bold text-red-600 mb-2">هل أنت متأكد؟ سيتم حذف كل شيء!</p>
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => {
                      localStorage.removeItem(STORAGE_KEY);
                      setProviders([{ id: 'p1', name: 'المورد 1' }]);
                      setItems([{ id: 'i1', name: '', quantity: 1, prices: { p1: 0 } }]);
                      setSubject('');
                      setLastSaved(null);
                      setShowResetConfirm(false);
                    }}
                    className="bg-red-600 text-white px-2 py-1 text-[10px] rounded hover:bg-red-700"
                  >
                    تأكيد الحذف
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    className="bg-slate-100 text-slate-600 px-2 py-1 text-[10px] rounded hover:bg-slate-200"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              const data = { providers, items, subject };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
              setLastSaved(new Date().toLocaleTimeString('fr-FR'));
            }}
            className="bg-slate-100 text-slate-700 px-3 py-1 text-xs hover:bg-slate-200 flex items-center gap-2 transition-colors border border-slate-300 rounded"
            title="حفظ البيانات يدوياً"
          >
            <Save className="w-3 h-3" />
            <span>حفظ الآن</span>
          </button>
          
          <button 
            onClick={handlePrint} 
            className="bg-slate-800 text-white px-4 py-1 text-xs hover:bg-slate-900 flex items-center gap-2 transition-colors rounded"
            title="طباعة أو حفظ بتنسيق PDF"
          >
            <Printer className="w-3 h-3" />
            <span>طباعة / حفظ PDF</span>
          </button>
        </div>

        {/* Save/Load Tools (Hidden on Print) */}
        <div className="mb-4 flex flex-wrap gap-4 items-center print:hidden no-print p-3 bg-slate-50 border border-slate-200 rounded">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">التخزين المحلي:</span>
            <button 
              onClick={handleExport}
              className="bg-white border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2 rounded transition-colors"
            >
              <Download className="w-3 h-3 text-slate-600" />
              <span>تصدير كملف</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2 rounded transition-colors"
            >
              <Upload className="w-3 h-3 text-slate-600" />
              <span>تحميل من الجهاز</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              accept=".json" 
              className="hidden" 
            />
          </div>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">التخزين السحابي:</span>
            {!user ? (
              <button 
                onClick={handleAuthAction}
                className="bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700 flex items-center gap-2 rounded transition-colors"
              >
                <LogIn className="w-3 h-3" />
                <span>تسجيل الدخول للحفظ</span>
              </button>
            ) : (
              <>
                <button 
                  onClick={handleCloudSave}
                  disabled={isCloudLoading}
                  className="bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700 flex items-center gap-2 rounded transition-colors disabled:opacity-50"
                >
                  <CloudUpload className="w-3 h-3" />
                  <span>{isCloudLoading ? 'جاري الحفظ...' : 'حفظ في السحاب'}</span>
                </button>
                <button 
                  onClick={handleCloudLoad}
                  disabled={isCloudLoading}
                  className="bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1.5 text-xs hover:bg-blue-100 flex items-center gap-2 rounded transition-colors disabled:opacity-50"
                >
                  <CloudDownload className="w-3 h-3" />
                  <span>{isCloudLoading ? 'جاري التحميل...' : 'تحميل من السحاب'}</span>
                </button>
                <div className="flex items-center gap-2 mr-4 bg-white border border-slate-200 px-2 py-1 rounded">
                  <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-300">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-full h-full p-1 text-slate-400" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 max-w-[80px] truncate">{user.displayName || user.email}</span>
                  <button onClick={handleAuthAction} className="text-red-500 hover:text-red-700">
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Print Options (Hidden on Print) */}
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded print:hidden no-print flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">خيارات الطباعة:</span>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showRecommendation} 
              onChange={(e) => setShowRecommendation(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-700">إظهار فقرة الاقتراح (التذييل)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={highlightBestValue} 
              onChange={(e) => setHighlightBestValue(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-slate-700">تمييز أفضل عرض (بأخضر)</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-slate-700">تنسيق التاشير:</span>
            <select 
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
            </select>
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              {/* Provider Names Row */}
              <tr>
                <th rowSpan={2} className="border border-black p-1 w-8">ع/ر</th>
                <th rowSpan={2} className="border border-black p-1 min-w-[150px] group cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleSort('name')}>
                  <div className="flex items-center justify-center gap-2">
                    <span>بيان المواد</span>
                    <div className="print:hidden">
                      <SortIcon columnKey="name" />
                    </div>
                  </div>
                </th>
                <th rowSpan={2} className="border border-black p-1 w-12 group cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleSort('quantity')}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <span>الكمية</span>
                    <div className="print:hidden">
                      <SortIcon columnKey="quantity" />
                    </div>
                  </div>
                </th>
                {providers.map(p => (
                  <th key={p.id} colSpan={2} className="border border-black p-1 group relative">
                    <div className="flex flex-col items-center gap-1">
                      <input 
                        type="text" 
                        value={p.name} 
                        onChange={(e) => updateProviderName(p.id, e.target.value)}
                        className="w-full text-center font-bold bg-transparent border-none focus:ring-0 p-0 print:placeholder-transparent"
                      />
                      <button 
                        onClick={() => toggleSort(`price_${p.id}`)}
                        className="print:hidden p-1 hover:bg-slate-200 rounded transition-colors"
                        title="ترتيب حسب السعر"
                      >
                        <SortIcon columnKey={`price_${p.id}`} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
              {/* Sub-headers Row */}
              <tr>
                {providers.map(p => (
                  <Fragment key={p.id}>
                    <th className="border border-black p-1 w-20">السعر الفردي</th>
                    <th className="border border-black p-1 w-20">السعر الجملي</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {sortedItems.map((item, idx) => (
                  <motion.tr 
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group"
                  >
                    <td className="border border-black p-1 text-center">{idx + 1}</td>
                    <td className="border border-black p-1">
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 p-0 print:placeholder-transparent"
                        placeholder="أدخل بيان المادة..."
                      />
                    </td>
                    <td className="border border-black p-1 text-center">
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full text-center bg-transparent border-none focus:ring-0 p-0"
                      />
                    </td>
                    {providers.map(p => {
                      const price = item.prices[p.id] || 0;
                      const total = price * item.quantity;
                      
                      // Check if this is the best price for this row
                      const validPrices = providers.map(prov => item.prices[prov.id] || 0).filter(v => v > 0);
                      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                      const isBestPrice = highlightBestValue && price > 0 && price === minPrice;

                      return (
                        <Fragment key={p.id}>
                          <td className={`border border-black p-1 text-center transition-colors ${isBestPrice ? 'bg-emerald-50/80 print:bg-emerald-50' : ''}`}>
                            <input 
                              type="number" 
                              value={price} 
                              onChange={(e) => updatePrice(item.id, p.id, parseFloat(e.target.value) || 0)}
                              className={`w-full text-center bg-transparent border-none focus:ring-0 p-0 font-mono ${isBestPrice ? 'font-bold text-emerald-900' : ''}`}
                              step="0.001"
                            />
                          </td>
                          <td className={`border border-black p-1 text-center font-bold font-mono transition-colors ${isBestPrice ? 'bg-emerald-50/80 print:bg-emerald-50 text-emerald-900' : ''}`}>
                            {total > 0 ? parseFloat(total.toFixed(3)).toLocaleString() : ''}
                          </td>
                        </Fragment>
                      );
                    })}
                  </motion.tr>
                ))}
              </AnimatePresence>
              {/* Grand Totals Row */}
              <tr className="font-bold">
                <td colSpan={3} className="border border-black p-2 text-center bg-slate-50">المبلغ الجملي المقترح لكامل القسط</td>
                {providers.map(p => {
                  const isBestTotal = highlightBestValue && bestProvider?.id === p.id && totals[p.id] > 0;
                  return (
                    <td 
                      key={p.id} 
                      colSpan={2} 
                      className={`border border-black p-2 text-center font-mono text-xs transition-colors ${
                        isBestTotal ? 'bg-emerald-100/50 print:bg-emerald-100 ring-1 ring-inset ring-emerald-600/20' : ''
                      }`}
                    >
                      {totals[p.id] > 0 ? totals[p.id].toLocaleString() : ''}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recommendation Footer */}
        {showRecommendation && bestProvider && totals[bestProvider.id] > 0 && (
          <div className="mt-12 text-sm font-bold leading-loose recommendation-footer">
            <p>
              حسب جدول مقارنة الأثمان تقترح اللجنة التعامل مع شركة <span className="underline px-2">{bestProvider.name}</span> بمبلغ قدره <span className="underline px-2">{totals[bestProvider.id].toLocaleString()} د</span>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
