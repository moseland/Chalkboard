import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Extremely important to send HttpOnly cookies
});

// Attach access token to every request if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Catch 401 missing access token and attempt to refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loop if the refresh endpoint itself fails
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;

      try {
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true } // Manually attach cookies since it bypasses the main instance here
        );

        const newAccessToken = res.data.access_token;
        localStorage.setItem('token', newAccessToken);

        // Update the failed request with the new token and retry
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, user must log in again
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, inviteToken) => api.post('/auth/register', { email, password, invite_token: inviteToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me')
};

export const boards = {
  getAll: () => api.get('/boards'),
  get: (id) => api.get(`/boards/${id}`),
  create: (title) => api.post('/boards', { title }),
  update: (id, data) => api.patch(`/boards/${id}`, data),
  delete: (id) => api.delete(`/boards/${id}`),
  duplicate: (id) => api.post(`/boards/${id}/duplicate`)
};

export const images = {
  generate: (payload) => api.post('/images/generate', payload),
  edit: (payload) => api.post('/images/edit', payload)
};

export const stock = {
  search: (query, page = 1) => api.get('/stock/search', { params: { query, page } })
};

export default api;
