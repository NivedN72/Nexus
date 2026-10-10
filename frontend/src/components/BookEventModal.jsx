import React, { useState, useEffect } from 'react';
import { X, Ticket, AlertCircle, CheckCircle2, Calendar, Download } from 'lucide-react';
import { api } from '../services/api';

function downloadIcsFile(event, booking) {
  const startDate = new Date(event.date || Date.now());
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2-hour duration
  const formatIcs = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexus Campus Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking?.bookingId || event.eventId}@nexus.campus`,
    `DTSTAMP:${formatIcs(new Date())}`,
    `DTSTART:${formatIcs(startDate)}`,
    `DTEND:${formatIcs(endDate)}`,
    `SUMMARY:${event.title || 'Campus Event'}`,
    `DESCRIPTION:${(event.description || 'Nexus Campus Event Pass').replace(/\n/g, ' ')}`,
    `LOCATION:${event.venue || 'Campus Venue'}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(event.title || 'campus_event').toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function BookEventModal({ isOpen, onClose, event, currentUser, onBookingSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);

  // Keyboard Escape listener per better-accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen || !event || !currentUser?.token) return null;

  const reserve = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.bookEvent(event.eventId, currentUser);
      setBooking(result.booking);
      onBookingSuccess(result);
    } catch (err) {
      setError(err.message || 'Could not reserve your seat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div className="glass-card w-full max-w-lg rounded-3xl p-6 sm:p-7 border border-white/10 relative shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          disabled={loading}
          onClick={onClose}
          aria-label="Close booking modal"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <h2 id="modal-title" className="text-xl font-bold mb-1.5 flex items-center gap-2.5 text-white">
          <Ticket className="w-5 h-5 text-indigo-400 shrink-0" />
          {booking ? 'Seat Confirmed!' : 'Reserve Your Seat'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-normal max-w-prose">
          {event.title} · <span className="text-cyan-300 font-medium">{event.venue}</span>
        </p>

        {error && (
          <div role="alert" className="mb-4 p-3.5 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {booking ? (
          <div className="space-y-4">
            {/* Digital Wallet Style Pass */}
            <div className="rounded-2xl p-5 border border-emerald-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 shadow-inner relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-emerald-400 font-bold flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Verified Digital Pass
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Valid
                </span>
              </div>

              <div className="py-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Attendee</span>
                  <span className="text-white font-semibold text-sm">{booking.attendeeName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Registered Email</span>
                  <span className="text-slate-200 truncate block font-mono text-[11px]">{booking.userEmail || currentUser.email}</span>
                </div>
              </div>

              {/* Perforated divider per better-ui */}
              <div className="relative my-2">
                <div className="border-t border-dashed border-white/15"></div>
                <div className="absolute -left-7 -top-2 w-4 h-4 rounded-full bg-[#0b0f19]"></div>
                <div className="absolute -right-7 -top-2 w-4 h-4 rounded-full bg-[#0b0f19]"></div>
              </div>

              {/* Barcode & Reference */}
              <div className="pt-2 text-center">
                <div className="h-8 bg-white/90 rounded p-1 flex items-center justify-center space-x-1 mb-2 max-w-xs mx-auto">
                  {[3, 1, 4, 2, 5, 2, 4, 1, 3, 5, 2, 4, 1, 4, 2, 3, 5, 1, 4, 2, 4, 2].map((w, idx) => (
                    <div key={idx} className="bg-black h-full" style={{ width: `${w}px` }}></div>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-slate-400 tracking-wider">
                  TICKET: {booking.bookingId}
                </p>
              </div>
            </div>

            {/* Actions: Add to Calendar & Close */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => downloadIcsFile(event, booking)}
                className="flex-1 py-3 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Add to Calendar (.ics)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-lg shadow-indigo-600/30"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl p-4 bg-slate-900 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Account Confirmation</span>
              <p className="font-semibold text-white text-sm">{currentUser.name}</p>
              <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              One seat per account for this event. Your reservation will be atomically verified against current capacity in DynamoDB.
            </p>
            <button
              disabled={loading}
              onClick={reserve}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all duration-150 ease-out active:scale-[0.96] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Verifying Capacity…</span>
                </>
              ) : (
                <>
                  <Ticket className="w-4 h-4" />
                  <span>Confirm Reservation</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
