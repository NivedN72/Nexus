import { DEFAULT_CONFIG } from '../config';

const getBaseUrl = () => {
  const stored = localStorage.getItem('nexus_api_url');
  if (stored && !stored.includes('k65kqaeq')) {
    return stored;
  }
  return DEFAULT_CONFIG.apiBaseUrl;
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
    const headers = {
      'Content-Type': 'application/json',
    };
    if (currentUser?.token) {
      headers['Authorization'] = currentUser.token;
    } else {
      // Mock admin fallback for presentation demo
      headers['x-mock-role'] = 'admin';
    }

    const res = await fetch(`${getBaseUrl()}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(eventData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create event');
    return data;
  },

  async bookEvent(eventId, currentUser) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (currentUser?.token) {
      headers['Authorization'] = currentUser.token;
    } else {
      // Mock student fallback
      headers['x-mock-user'] = currentUser?.email || 'student-alice@campus.edu';
    }

    const res = await fetch(`${getBaseUrl()}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed');
    return data;
  },

  async getMyBookings(currentUser) {
    const headers = {};
    if (currentUser?.token) {
      headers['Authorization'] = currentUser.token;
    } else {
      headers['x-mock-user'] = currentUser?.email || 'student-alice@campus.edu';
    }

    const res = await fetch(`${getBaseUrl()}/bookings/me`, { headers });
    if (!res.ok) throw new Error('Failed to fetch user bookings');
    return res.json();
  },

  // 2. Lost & Found Items
  async getItems(type = null) {
    const url = type ? `${getBaseUrl()}/items?type=${type}` : `${getBaseUrl()}/items`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch items');
    return res.json();
  },

  async reportItem(itemData, currentUser) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (currentUser?.token) {
      headers['Authorization'] = currentUser.token;
    } else {
      headers['x-mock-user'] = currentUser?.email || 'student-reporter@campus.edu';
      headers['x-mock-email'] = currentUser?.email || 'student-reporter@campus.edu';
    }

    const res = await fetch(`${getBaseUrl()}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(itemData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to report item');
    return data;
  },

  // 3. Direct S3 Upload via Pre-signed URL
  async uploadPhotoToS3(uploadUrl, file) {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
      },
      body: file,
    });

    if (!res.ok) throw new Error(`Direct S3 upload failed with status ${res.status}`);
    return true;
  }
};
