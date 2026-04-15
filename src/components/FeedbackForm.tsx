import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { MessageSquare, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FeedbackForm({ showToast }: { showToast: (message: string, type: 'success' | 'error') => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const feedbackData = {
        email,
        message: feedback,
        createdAt: Date.now(),
        status: 'new'
      };

      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'feedback'), feedbackData);
      } else {
        // Demo Mode
        const localFeedback = JSON.parse(localStorage.getItem('demo_feedback') || '[]');
        localStorage.setItem('demo_feedback', JSON.stringify([...localFeedback, { ...feedbackData, id: Date.now().toString() }]));
      }

      setSuccess(true);
      showToast("Feedback sent successfully!", "success");
      setFeedback('');
      setEmail('');
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      showToast("Failed to send feedback. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white p-8 rounded-[32px] shadow-2xl border border-stone-100 w-80 mb-4"
          >
            {success ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle2 className="text-organic-green mx-auto" size={48} />
                <h3 className="text-xl font-serif font-bold">Thank You!</h3>
                <p className="text-stone-500 text-sm">Your feedback helps us grow.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-serif font-bold mb-4">Share Feedback</h3>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Email</label>
                  <input 
                    required
                    type="email"
                    className="w-full p-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green text-sm"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Message</label>
                  <textarea 
                    required
                    rows={4}
                    className="w-full p-3 rounded-xl bg-stone-50 border-none focus:ring-2 focus:ring-organic-green text-sm"
                    placeholder="Tell us what you think..."
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-organic-green text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  Send Feedback
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-organic-green text-white rounded-full flex items-center justify-center shadow-xl shadow-organic-green/20 hover:scale-110 transition-transform"
      >
        <MessageSquare size={28} />
      </button>
    </div>
  );
}
