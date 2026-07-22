import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const httpClient = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

// Request interceptor to add token
httpClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("auth_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default httpClient;
