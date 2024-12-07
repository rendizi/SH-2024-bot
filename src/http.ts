import axios from "axios";
import { getSavedToken, saveToken } from "./utils";

let token = "";

export const setToken = (to: string)=>{
    token = to 
}

const http = axios.create({
  baseURL: process.env.BASE_URL,
  timeout: 5000,
});

http.interceptors.request.use(
  (config) => {
    console.log("Using token:", token);
    if (token) {
      config.headers.Authorization = `${token}`; 
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

http.interceptors.response.use(
  async (response) => {
    if (response.data.token) {
      token = response.data.token;
      console.log("Token updated:", token);
      try {
        await saveToken(token);
      } catch (error: any) {
        console.error("Error saving token:", error.message);
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default http;
