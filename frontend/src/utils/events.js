const eventTime = event => {
  const time = Date.parse(event?.date);
  return Number.isFinite(time) ? time : Infinity;
};

export const isPastEvent = (event, now = Date.now()) => {
  const time = eventTime(event);
  return Number.isFinite(time) && time <= now;
};

export const sortEventsByDate = (entries, getEvent = event => event) => [...entries].sort((a, b) => {
  const first = eventTime(getEvent(a));
  const second = eventTime(getEvent(b));
  if (first === second) return 0;
  if (!Number.isFinite(first)) return 1;
  if (!Number.isFinite(second)) return -1;
  return second - first;
});
