import axios from "axios";
import type {
  Coupon,
  CouponBalance,
  CouponRedeem,
  CouponValidation,
  Merchant,
  Survey,
  SurveyResponseCreate,
  SurveyResponseResponse,
  User,
  UserCreate,
  UserPoints,
} from "@/types";
import { API_V1 } from "./config";

// El token del comercio se guarda aparte del del ciudadano: en el mismo navegador
// puede haber una sesión de cada uno y no deben pisarse.
export const MERCHANT_TOKEN_KEY = "merchant_token";

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
  getAvailable: () => api.get<Survey[]>("/surveys/available"),
  getById: (surveyId: string) => api.get<Survey>(`/surveys/${surveyId}`),
  submitResponse: (data: SurveyResponseCreate) =>
    api.post<SurveyResponseResponse>("/surveys/responses", data),
  canRespond: (surveyId: string, userId: string) =>
    api.get<{ can_respond: boolean; message: string }>(
      `/surveys/can-respond/${surveyId}/${userId}`
    ),
};

// Cupones — lado del ciudadano (usa el token de ciudadano del interceptor)
export const couponsApi = {
  getBalances: () => api.get<CouponBalance[]>("/coupons/balances"),
  getMine: (clientId?: string) =>
    api.get<Coupon[]>("/coupons/me", {
      params: clientId ? { client_id: clientId } : undefined,
    }),
  create: (clientId: string, rewardId: string) =>
    api.post<Coupon>("/coupons", { client_id: clientId, reward_id: rewardId }),
};

// Instancia separada para el comercio: su token vive en otra clave.
const merchantAxios = axios.create({
  baseURL: API_V1,
  headers: { "Content-Type": "application/json" },
});

merchantAxios.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(MERCHANT_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const merchantApi = {
  // Público: hace falta para elegir la entidad en el alta, antes de tener cuenta.
  getEntities: () =>
    merchantAxios.get<{ id: string; name: string }[]>("/merchants/entities"),
  login: (email: string, password: string) =>
    merchantAxios.post<{ access_token: string; token_type: string }>(
      "/merchants/login",
      { email, password }
    ),
  register: (data: {
    client_id: string;
    email: string;
    password: string;
    name: string;
    cuit?: string;
    address?: string;
    phone?: string;
  }) => merchantAxios.post<Merchant>("/merchants/register", data),
  me: () => merchantAxios.get<Merchant>("/merchants/me"),
  validateCoupon: (code: string) =>
    merchantAxios.get<CouponValidation>(`/coupons/validate/${code}`),
  redeemCoupon: (code: string) =>
    merchantAxios.post<CouponRedeem>(`/coupons/${code}/redeem`),
};

export default api;
