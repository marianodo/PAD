import axios from "axios";
import type {
  Survey,
  SurveyResponseCreate,
  SurveyResponseResponse,
  User,
  UserCreate,
  UserPoints,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_V1 = `${API_URL}/api/v1`;

const api = axios.create({
  baseURL: API_V1,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth
export const authApi = {
  me: () => api.get<User>("/auth/me"),
};

// Users
export const usersApi = {
  create: (data: UserCreate) => api.post<User>("/users", data),
  getById: (userId: string) => api.get<User>(`/users/${userId}`),
  getByEmail: (email: string) => api.get<User>(`/users/email/${email}`),
  getPoints: (userId: string) => api.get<UserPoints>(`/users/${userId}/points`),
};

// Surveys
export const surveysApi = {
  getActive: () => api.get<Survey>("/surveys/active"),
  getById: (surveyId: string) => api.get<Survey>(`/surveys/${surveyId}`),
  submitResponse: (data: SurveyResponseCreate) =>
    api.post<SurveyResponseResponse>("/surveys/responses", data),
  canRespond: (surveyId: string, userId: string) =>
    api.get<{ can_respond: boolean; message: string }>(
      `/surveys/can-respond/${surveyId}/${userId}`
    ),
};

export default api;
