import { DEFAULT_CONFIG } from '../config';

const getBaseUrl = () => {
  const stored = localStorage.getItem('nexus_api_url');
  if (stored && !stored.includes('k65kqaeq')) {
    return stored;
  }
  return DEFAULT_CONFIG.apiBaseUrl;
};

const authHeaders = (user) => {
  if (!user?.token) throw new Error('Please sign in to continue.');
  return { Authorization: user.token };
};

export const api = {
  // 1. Events
  async getEvents() {
    const res = await fetch(`${getBaseUrl()}/events`);
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.statusText}`);
    return res.json();
  },

  async getEventById(id) {
    const res = await fetch(`${getBaseUrl()}/events/${id}`);
    if (!res.ok) throw new Error(`Event not found: ${res.statusText}`);
    return res.json();
  },

  async createEvent(eventData, currentUser) {
    if (currentUser?.role !== 'admin') throw new Error('Only campus admins can create events.');
    const headers = { ...authHeaders(currentUser), 'Content-Type': 'application/json' };
    const payload = eventData;

    const res = await fetch(`${getBaseUrl()}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create event');
    return data;
  },

  async bookEvent(eventId, currentUser) {
    if (currentUser?.role === 'admin') throw new Error('Admin accounts cannot book seats.');
    const res = await fetch(`${getBaseUrl()}/bookings`, {
      method: 'POST',
      headers: { ...authHeaders(currentUser), 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed');
    return data;
  },

  async getMyBookings(currentUser) {
    const res = await fetch(`${getBaseUrl()}/bookings/me`, { headers: authHeaders(currentUser) });
    if (!res.ok) throw new Error('Failed to fetch user bookings');
    return res.json();
  },

  // 2. Lost & Found Items
  async getItems(currentUser, type = null) {
    if (!currentUser?.isStudent) throw new Error('Lost & Found is available to verified students only.');
    const url = type ? `${getBaseUrl()}/items?type=${type}` : `${getBaseUrl()}/items`;
    const res = await fetch(url, { headers: authHeaders(currentUser) });
    if (!res.ok) throw new Error('Failed to fetch items');
    return res.json();
  },

  async reportItem(itemData, currentUser) {
    if (!currentUser?.isStudent) throw new Error('Lost & Found is available to verified students only.');
    const headers = { ...authHeaders(currentUser), 'Content-Type': 'application/json' };
    const payload = itemData;

    const res = await fetch(`${getBaseUrl()}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to report item');
    return data;
  },

  // Signed POST policies enforce size and type; PUT supports the previous API during rollout.
  async uploadPhotoToS3(upload, file) {
    const isPost = typeof upload === 'object' && upload !== null;
    const url = isPost ? upload.url : upload;
    if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Invalid photo upload URL');
    let options;
    if (isPost) {
      if (!upload.fields || typeof upload.fields !== 'object') throw new Error('Invalid photo upload policy');
      const body = new FormData();
      for (const [name, value] of Object.entries(upload.fields)) body.append(name, value);
      body.append('file', file);
      // The browser supplies the multipart boundary. Do not set Content-Type manually.
      options = { method: 'POST', body };
    } else {
      options = { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file };
    }
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Photo upload failed with status ${res.status}`);
    return true;
  }
};
