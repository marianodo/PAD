export enum QuestionType {
  MULTIPLE_CHOICE = "multiple_choice",
  SINGLE_CHOICE = "single_choice",
  PERCENTAGE_DISTRIBUTION = "percentage_distribution",
  RATING = "rating",
  OPEN_TEXT = "open_text",
}

export interface QuestionOption {
  id: string;
  option_text: string;
  option_value?: string;
  description?: string;
  image_url?: string;
  order_index?: number;
}

export interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  order_index: number;
  is_required: boolean;
  config: Record<string, any>;
  options: QuestionOption[];
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  status: string;
  points_per_question: number;
  bonus_points: number;
  created_at: string;
  expires_at?: string;
  questions: Question[];
}

export interface Answer {
  question_id: string;
  option_id?: string;
  option_ids?: string[]; // Para MULTIPLE_CHOICE (uso frontend, se expande al enviar)
  answer_text?: string;
  rating?: number;
  percentage_data?: Record<string, number>;
}

export interface SurveyResponseCreate {
  survey_id: string;
  user_id: string;
  answers: Answer[];
  completed: boolean;
}

export interface SurveyResponseResponse {
  id: string;
  survey_id: string;
  user_id: string;
  completed: boolean;
  points_earned: number;
  started_at: string;
  completed_at?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  postal_code?: string;
  created_at: string;
}

export interface UserCreate {
  email: string;
  name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  postal_code?: string;
}

export interface UserPoints {
  // Ausentes cuando la respuesta es la suma de los saldos de varias entidades.
  id?: string;
  client_id?: string;
  user_id: string;
  total_points: number;
  available_points: number;
  redeemed_points: number;
  updated_at?: string;
}

// --- Cupones ---

export interface CouponReward {
  id: string;
  client_id: string;
  name: string;
  points_cost: number;
  discount_pct: number;
  affordable?: boolean;
}

/** Saldo del ciudadano en una entidad, con el catálogo de esa entidad. */
export interface CouponBalance {
  client_id: string;
  client_name: string;
  available_points: number;
  total_points: number;
  rewards: CouponReward[];
}

export type CouponStatus = "active" | "redeemed" | "expired";

export interface Coupon {
  id: string;
  code: string;
  client_id: string;
  reward_id: string;
  discount_pct: number;
  points_spent: number;
  status: CouponStatus;
  created_at?: string;
  expires_at: string;
  redeemed_at?: string;
  client_name?: string;
  reward_name?: string;
  /** Solo viene en el historial del propio dueño del cupón. */
  redeemed_by_merchant_name?: string;
}

export interface CouponValidation {
  code: string;
  valid: boolean;
  discount_pct: number;
  expires_at: string;
  reward_name?: string;
}

export interface CouponRedeem {
  code: string;
  discount_pct: number;
  redeemed_at: string;
  reward_name?: string;
}

export type MerchantStatus = "pending" | "approved" | "rejected";

export interface Merchant {
  id: string;
  client_id: string;
  email: string;
  name: string;
  cuit?: string;
  address?: string;
  phone?: string;
  status: MerchantStatus;
  client_name?: string;
  created_at?: string;
}
