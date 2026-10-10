import ModalShell from './ModalShell';
import React, { useState } from 'react';
import { X, Calendar, MapPin, Users, PlusCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function CreateEventModal({ isOpen, onClose, currentUser, onEventCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [totalSeats, setTotalSeats] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !venue.trim() || !date) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const isoDate = new Date(date).toISOString();

      await api.createEvent(
        {
          title: title.trim(),
          description: description.trim(),
          date: isoDate,
          venue: venue.trim(),
          totalSeats: parseInt(totalSeats, 10),
        },
        currentUser
      );

      setLoading(false);
      onEventCreated();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create event');
      setLoading(false);
    }
  };

  return (
    <ModalShell label="Campus organisers" title="Make something worth showing up for." description="Create an event and bring your campus together." className="nexus-dialog-createevent">
        
        {/* Close Button */}
        <button
          aria-label="Close campus organisers"
          onClick={onClose}
          className="absolute top-5 right-5 text-muted hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center text-accent-ink">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Create Campus Event</h2>
            <p className="text-xs text-muted">Admin-only route protected by Cognito group checks</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger/15 border border-danger/25 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Event Title *</label>
            <input
              type="text"
              placeholder="e.g. AWS Cloud Hackathon 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-soft border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent-ink/25"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Total Seats *</label>
              <input
                type="number"
                min="1"
                max="5000"
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                className="w-full bg-soft border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent-ink/25"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Venue / Location *</label>
            <input
              type="text"
              placeholder="e.g. Auditorium A, Tech Hall Room 302"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Description</label>
            <textarea
              rows="3"
              placeholder="Brief details about the event, keynote speakers, requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-soft border border-line rounded-xl px-3.5 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent-ink/25 resize-none"
            ></textarea>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-accent   hover:bg-accent-hover hover:bg-accent-hover text-ink shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin"></span>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  Publish Event to DynamoDB
                </>
              )}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
