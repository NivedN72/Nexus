import React from 'react';
import { CheckCircle2, Ticket } from 'lucide-react';

export default function BookingPass({ booking }) {
  return <article className="nexus-admission-pass">
    <div className="nexus-admission-heading"><Ticket size={19}/><span>Campus admission</span><span className="nexus-admission-status"><CheckCircle2 size={13}/>{booking.status || 'CONFIRMED'}</span></div>
    <div className="nexus-admission-body"><h2>{booking.eventTitle || 'Campus Event'}</h2><p>Booked on: {new Date(booking.bookingTime).toLocaleString()}</p></div>
    <div className="nexus-admission-stub"><span>Valid Campus Pass</span><strong>ID: {booking.bookingId.slice(0,8)}...</strong><span className="nexus-ticket-stripes" aria-hidden="true"/></div>
  </article>;
}
