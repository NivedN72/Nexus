import React from 'react';
import { MapPin, Ticket, ArrowUpRight, ShieldCheck, LoaderCircle } from 'lucide-react';

export default function EventCard({ event, onBook, bookingLoading, canBook = true }) {
  const total = Number(event.totalSeats) || 0;
  const booked = Number(event.seatsBooked) || 0;
  const remaining = Math.max(0, total - booked);
  const percentage = total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const isSoldOut = remaining <= 0;
  const date = new Date(event.date);
  const validDate = !Number.isNaN(date.getTime());

  return <article className={`nexus-agenda-event ${isSoldOut ? 'is-sold-out' : ''}`}>
    <div className="nexus-agenda-date">
      <span>{validDate ? date.toLocaleDateString('en-US', { month: 'short' }) : 'Date'}</span>
      <strong>{validDate ? date.getDate() : '—'}</strong>
      <span>{validDate ? date.toLocaleDateString('en-US', { weekday: 'short' }) : 'TBC'}</span>
    </div>
    <div className="nexus-agenda-copy">
      <div className="nexus-agenda-meta"><span>{validDate ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : event.date}</span><span><MapPin size={13} aria-hidden="true"/>{event.venue}</span></div>
      <h3>{event.title}</h3>
      <p>{event.description || 'No description provided.'}</p>
      <small className="nexus-agenda-note"><ShieldCheck size={12} aria-hidden="true"/>Atomic Conditional Write (Race-Condition Free)</small>
    </div>
    <div className="nexus-agenda-reservation">
      <div className="nexus-agenda-availability"><strong>{remaining.toString().padStart(2,'0')}</strong><span>{isSoldOut ? 'Sold out' : remaining <= 5 ? 'Only '+remaining+' left!' : 'Seats free'}</span></div>
      <div className="nexus-agenda-progress" role="progressbar" aria-label="Booked capacity" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{width: `${percentage}%`}} /></div>
      <small>{booked} / {total} booked ({percentage}%)</small>
      {canBook && <button type="button" className="nexus-agenda-book" onClick={()=>onBook(event)} disabled={isSoldOut || bookingLoading}>
        {bookingLoading ? <><LoaderCircle size={16} className="animate-spin"/>Booking…</> : isSoldOut ? 'Capacity Reached' : <><Ticket size={16}/>Book Seat Now<ArrowUpRight size={17}/></>}
      </button>}
    </div>
  </article>;
}
