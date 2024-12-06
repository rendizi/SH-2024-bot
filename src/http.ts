import axios from "axios";

let token = ""

const http = axios.create({
    baseURL: process.env.BASE_URL,
    timeout: 5000,
});

http.interceptors.request.use(
    (config) => {
        config.headers.Authorization = token;  
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

http.interceptors.request.use(
    (config) => {
        if (config.data.token){
            token = config.data.token
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);  

export default http 