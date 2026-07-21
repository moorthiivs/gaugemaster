import axios from "axios";

const httpClient = axios.create({
    baseURL: (window as any).API_URL || "http://localhost:5000/api", // Standardized port and prefix
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
