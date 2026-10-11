const eventTime = event => {
  const time = Date.parse(event.date);
  return Number.isFinite(time) ? time : Infinity;
};

export const isPastEvent = (event, now = Date.now()) => {
  const time = eventTime(event);
  return Number.isFinite(time) && time <= now;
};

export const sortEventsByDate = events => [...events].sort((a, b) => {
  const first = eventTime(a);
  const second = eventTime(b);
  return first === second ? 0 : first < second ? -1 : 1;
});
