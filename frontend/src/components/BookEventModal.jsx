import React, { useState } from 'react';
import { X, Ticket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function BookEventModal({ isOpen, onClose, event, currentUser, onBookingSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  if (!isOpen || !event || !currentUser?.token) return null;
  const reserve = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const result = await api.bookEvent(event.eventId, currentUser);
      setBooking(result.booking); onBookingSuccess(result);
    } catch (err) { setError(err.message || 'Could not reserve your seat.'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-card w-full max-w-lg rounded-3xl p-6 border border-white/10 relative">
        <button disabled={loading} onClick={onClose} aria-label="Close booking" className="absolute top-5 right-5 text-slate-400 hover:text-white disabled:opacity-50"><X className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Ticket className="w-5 h-5 text-indigo-400" />{booking ? 'Seat Confirmed!' : 'Reserve Your Seat'}</h2>
        <p className="text-sm text-slate-300 mb-5">{event.title} · {event.venue}</p>
        {error && <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/15 text-rose-300 flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
        {booking ? (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 border border-emerald-500/30 bg-slate-900">
              <p className="text-emerald-300 font-bold flex gap-2"><CheckCircle2 className="w-5 h-5" />Valid Campus Pass</p>
              <p className="mt-3">{booking.attendeeName}</p>
              <p className="text-sm text-slate-400">{booking.userEmail || currentUser.email}</p>
              <p className="mt-3 text-xs font-mono break-all">Ticket: {booking.bookingId}</p>
            </div>
            <p className="text-xs text-slate-400">Your ticket is available in My Bookings.</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-slate-800 font-semibold">Close</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl p-4 bg-slate-900 border border-white/5"><p className="font-semibold">{currentUser.name}</p><p className="text-sm text-slate-400">{currentUser.email}</p></div>
            <p className="text-xs text-slate-400">One seat per account for this event. Your reservation is linked to your signed-in account.</p>
            <button disabled={loading} onClick={reserve} className="w-full py-3 rounded-xl bg-indigo-600 font-bold disabled:opacity-50">{loading ? 'Reserving…' : 'Confirm Reservation'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
