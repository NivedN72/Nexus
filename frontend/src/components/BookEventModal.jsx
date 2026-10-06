import React, { useState } from 'react';
import { X, Mail, User, KeyRound, Ticket, AlertCircle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export default function BookEventModal({ isOpen, onClose, event, currentUser, onBookingSuccess }) {
  const [step, setStep] = useState(1); // 1: Enter details, 2: Enter code, 3: Confirmed ticket
  const [name, setName] = useState(currentUser?.name || 'Student');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [code, setCode] = useState('');
  const [devHint, setDevHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  if (!isOpen || !event) return null;

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await api.requestBookingCode({
        eventId: event.eventId,
        email: email.trim(),
        name: name.trim(),
      });

      if (result.devHintCode) {
        setDevHint(result.devHintCode);
      }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to request authorization code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndBook = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the 6-digit authorization code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await api.verifyAndBookSeat({
        eventId: event.eventId,
        email: email.trim(),
        name: name.trim(),
        authCode: code.trim(),
      });

      setConfirmedBooking(result.booking);
      setStep(3);
      onBookingSuccess(result);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Public Event Reservation</h2>
            <p className="text-xs text-slate-400">Strictly 1 seat per email • Email authorization required</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* STEP 1: ENTER NAME & EMAIL */}
        {step === 1 && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Target Event</span>
              <h3 className="text-base font-bold text-white">{event.title}</h3>
              <p className="text-xs text-slate-400">{event.venue}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Full Name
              </label>
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email Address (Strictly 1 seat allowed)
              </label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">We will send a 6-digit confirmation code to authorize this reservation.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Mail className="w-4 h-4" /> Send Email Authorization Code
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY 6-DIGIT CODE */}
        {step === 2 && (
          <form onSubmit={handleVerifyAndBook} className="space-y-4">
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200">
              <p className="font-semibold mb-1">Authorization Code Dispatched!</p>
              <p className="text-slate-300">
                A 6-digit code was sent to <strong className="text-white">{email}</strong>. Enter it below to complete your booking.
              </p>
              {devHint && (
                <div className="mt-2.5 pt-2 border-t border-indigo-500/20 text-[11px] text-cyan-300 font-mono">
                  🔑 Code for Demo Testing: <strong>{devHint}</strong>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> 6-Digit Authorization Code
              </label>
              <input
                type="text"
                maxLength="6"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-3 text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3 px-4 rounded-xl text-xs font-semibold text-slate-400 bg-slate-900/60 hover:text-white border border-white/5 transition-all"
              >
                Change Email
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Verify Code & Reserve Seat
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: VIRTUAL EVENT TICKET CONFIRMATION */}
        {step === 3 && confirmedBooking && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Seat Confirmed!</h3>
              <p className="text-xs text-slate-400">DynamoDB Atomic Conditional Write Succeeded</p>
            </div>

            {/* Perforated Event Pass Design */}
            <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/15 p-5 shadow-2xl overflow-hidden">
              <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Official Campus Pass</span>
                  <h4 className="text-lg font-bold text-white">{event.title}</h4>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                  VALID TICKET
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <span className="text-slate-500 block text-[10px]">Attendee:</span>
                  <strong className="text-white">{confirmedBooking.attendeeName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Email (1 Seat Allowed):</span>
                  <span className="text-slate-300 truncate block font-mono text-[11px]">{confirmedBooking.userId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Venue:</span>
                  <span className="text-slate-300">{event.venue}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Ticket ID:</span>
                  <span className="text-indigo-400 font-mono text-[10px]">{confirmedBooking.bookingId.slice(0, 16)}...</span>
                </div>
              </div>

              <div className="pt-2 border-t border-dashed border-white/10 flex items-center justify-between text-[10px] text-slate-500">
                <span>DynamoDB Record: Nexus-Bookings</span>
                <span>Protected Against Overbooking</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Close & View Events
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
