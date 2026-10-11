import React from 'react';
import { isPastEvent } from '../utils/events';
import { CalendarDays, CheckCircle2, Clock, MapPin, Ticket } from 'lucide-react';

export default function BookingPass({ booking, event, loadingEvent }) {
  const date = event?.date ? new Date(event.date) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const expired = Boolean(event && isPastEvent(event));
  const StatusIcon = expired ? Clock : CheckCircle2;
  return <article className={`nexus-admission-pass ${expired ? 'is-expired' : ''}`}>
    <div className="nexus-admission-heading"><Ticket size={19}/><span>Campus admission</span><span className="nexus-admission-status"><StatusIcon size={13}/>{expired ? 'Expired' : booking.status || 'CONFIRMED'}</span></div>
    <div className="nexus-admission-body">
      <h2>{event?.title || booking.eventTitle || 'Campus Event'}</h2>
      {expired && <p className="nexus-pass-expired-note">This event has passed. This pass is kept for your booking history.</p>}
      {event ? <>
        <dl className="nexus-pass-details">
          <div><dt><CalendarDays size={16}/>Event date</dt><dd>{validDate ? date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date unavailable'}</dd></div>
          <div><dt><Clock size={16}/>Time (your local time)</dt><dd>{validDate ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'Time unavailable'}</dd></div>
          <div className="nexus-pass-venue"><dt><MapPin size={16}/>Venue</dt><dd>{event.venue || 'Venue unavailable'}</dd></div>
        </dl>
        {event.description && <p className="nexus-pass-description">{event.description}</p>}
      </> : <p className="nexus-pass-description">{loadingEvent ? 'Loading event details...' : 'Event details are currently unavailable.'}</p>}
      <p className="nexus-pass-booked">Booked on: {new Date(booking.bookingTime).toLocaleString()}</p>
    </div>
    <div className="nexus-admission-stub"><span>{expired ? 'Expired Campus Pass' : event && validDate ? 'Valid Campus Pass' : 'Campus Pass'}</span><strong>ID: {booking.bookingId.slice(0,8)}...</strong><span className="nexus-ticket-stripes" aria-hidden="true"/></div>
  </article>;
}
