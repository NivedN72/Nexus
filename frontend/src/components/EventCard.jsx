import React, { useState } from 'react';
import { Calendar, MapPin, Users, Ticket, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function EventCard({ event, onBook, bookingLoading }) {
  const total = Number(event.totalSeats) || 0;
  const booked = Number(event.seatsBooked) || 0;
  const remaining = Math.max(0, total - booked);
  const percentage = total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const isSoldOut = remaining <= 0;

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group">
      
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all"></div>

      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            {formatDate(event.date)}
          </span>

          {isSoldOut ? (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              Sold Out
            </span>
          ) : remaining <= 5 ? (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              ⚡ Only {remaining} left!
            </span>
          ) : (
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {remaining} Seats Free
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
          {event.title}
        </h3>

        {/* Venue */}
        <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-3">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{event.venue}</span>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-300 line-clamp-3 mb-6 leading-relaxed">
          {event.description || 'No description provided.'}
        </p>
      </div>

      {/* Bottom Section: Seat Progress + Action */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center text-xs font-medium mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Booked Capacity
            </span>
            <span className="text-slate-200 font-mono">
              {booked} / {total} ({percentage}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSoldOut
                  ? 'bg-rose-500'
                  : percentage > 75
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
              }`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onBook(event.eventId)}
            disabled={isSoldOut || bookingLoading}
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              isSoldOut
                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-white/5'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-600/25 active:scale-[0.98]'
            }`}
          >
            {bookingLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isSoldOut ? (
              'Capacity Reached'
            ) : (
              <>
                <Ticket className="w-4 h-4" /> Book Seat Now
              </>
            )}
          </button>
        </div>

        {/* Cloud Computing Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Atomic Conditional Write (Race-Condition Free)</span>
        </div>
      </div>
    </div>
  );
}
