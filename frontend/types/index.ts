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
  address?: string;
  neighborhood?: string;
  city?: string;
  postal_code?: string;
}

export interface UserPoints {
  id: string;
  user_id: string;
  total_points: number;
  available_points: number;
  redeemed_points: number;
  updated_at: string;
}
