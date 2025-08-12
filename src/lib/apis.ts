//api.ts

import axios from "axios";


const api = axios.create({
    baseURL: (window as any).API_URL || "http://localhost:3000",
    withCredentials: true,
});

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("auth_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;
