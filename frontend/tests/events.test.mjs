import test from 'node:test';
import assert from 'node:assert/strict';
import { isPastEvent, sortEventsByDate } from '../src/utils/events.js';

test('events sort newest first across years and offsets without mutating the source', () => {
  const events = [
    { eventId: 'late', date: '2027-01-01T00:00:00Z' },
    { eventId: 'early', date: '2026-01-01T10:00:00+11:00' },
    { eventId: 'middle', date: '2026-01-01T00:00:00Z' },
    { eventId: 'unknown', date: 'TBC' },
  ];
  assert.deepEqual(sortEventsByDate(events).map(event => event.eventId), ['late', 'middle', 'early', 'unknown']);
  assert.deepEqual(events.map(event => event.eventId), ['late', 'early', 'middle', 'unknown']);
});

test('past status handles the scheduled instant, future dates, and unknown dates', () => {
  const now = Date.parse('2026-10-11T10:00:00Z');
  assert.equal(isPastEvent({ date: '2026-10-11T09:59:00Z' }, now), true);
  assert.equal(isPastEvent({ date: '2026-10-11T10:00:00Z' }, now), true);
  assert.equal(isPastEvent({ date: '2026-10-11T10:01:00Z' }, now), false);
  assert.equal(isPastEvent({ date: 'TBC' }, now), false);
});


test('bookings sort by event date rather than reservation time, with missing events last', () => {
  const events = [
    { eventId: 'older', date: '2026-01-01T00:00:00Z' },
    { eventId: 'newer', date: '2027-01-01T00:00:00Z' },
  ];
  const bookings = [
    { eventId: 'older', bookingTime: '2026-01-01T00:00:00Z' },
    { eventId: 'missing', bookingTime: '2025-01-01T00:00:00Z' },
    { eventId: 'newer', bookingTime: '2025-01-01T00:00:00Z' },
  ];
  assert.deepEqual(
    sortEventsByDate(bookings, booking => events.find(event => event.eventId === booking.eventId)).map(booking => booking.eventId),
    ['newer', 'older', 'missing'],
  );
  assert.deepEqual(bookings.map(booking => booking.eventId), ['older', 'missing', 'newer']);
});
