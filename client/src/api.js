import axios from 'axios';
const API = axios.create({ baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000' });

// Add request interceptor to include JWT
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;