import ModalShell from './ModalShell';
import React, { useState } from 'react';
import { X, Ticket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function BookEventModal({ isOpen, onClose, event, currentUser, onBookingSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  if (!isOpen || !event || !currentUser?.token) return null;
  const reserve = async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const result = await api.bookEvent(event.eventId, currentUser);
      setBooking(result.booking); setEmailStatus(result.confirmationEmail?.status || null); onBookingSuccess(result);
    } catch (err) { setError(err.message || 'Could not reserve your seat.'); }
    finally { setLoading(false); }
  };
  return (
    <ModalShell label="Event reservations" title="Your seat. Your next moment." description="One seat per account. Your campus pass stays linked to you." className="nexus-dialog-bookevent">
        <button disabled={loading} onClick={onClose} aria-label="Close booking" className="absolute top-5 right-5 text-muted hover:text-ink disabled:opacity-50"><X className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Ticket className="w-5 h-5 text-accent-ink" />{booking ? 'Seat Confirmed!' : 'Reserve Your Seat'}</h2>
        <p className="text-sm text-ink mb-5">{event.title} · {event.venue}</p>
        {error && <div role="alert" className="mb-4 p-3 rounded-xl bg-danger/15 text-danger flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
        {booking ? (
          <div data-motion="confirmation" className="space-y-4">
            <div className="rounded-2xl p-5 border border-success/25 bg-soft">
              <p className="text-success font-bold flex gap-2"><CheckCircle2 className="w-5 h-5" />Valid Campus Pass</p>
              <p className="mt-3">{booking.attendeeName}</p>
              <p className="text-sm text-muted">{booking.userEmail || currentUser.email}</p>
              <p className="mt-3 text-xs font-mono break-all">Ticket: {booking.bookingId}</p>
            </div>
            <p className="text-xs text-muted">Your ticket is available in My Bookings.</p>
            {emailStatus && <p role="status" className="text-xs text-muted">{emailStatus === 'sent'
              ? `A confirmation email has been sent to ${booking.userEmail || currentUser.email}. Check your spam folder too.`
              : 'Your seat is confirmed, but the confirmation email could not be sent. You can still access your ticket in My Bookings.'}</p>}
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-soft font-semibold">Close</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl p-4 bg-soft border border-line"><p className="font-semibold">{currentUser.name}</p><p className="text-sm text-muted">{currentUser.email}</p></div>
            <p className="text-xs text-muted">One seat per account for this event. Your reservation is linked to your signed-in account.</p>
            <button disabled={loading} onClick={reserve} className="nexus-button-primary w-full disabled:opacity-50">{loading ? 'Reserving…' : 'Confirm Reservation'}</button>
          </div>
        )}
    </ModalShell>
  );
}
