import { create } from "zustand";
import type { User, Survey, Answer } from "@/types";

interface SurveyStore {
  user: User | null;
  survey: Survey | null;
  answers: Answer[];
  currentStep: number;

  setUser: (user: User | null) => void;
  setSurvey: (survey: Survey | null) => void;
  addAnswer: (answer: Answer) => void;
  updateAnswer: (questionId: string, answer: Answer) => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

export const useSurveyStore = create<SurveyStore>((set) => ({
  user: null,
  survey: null,
  answers: [],
  currentStep: 0,

  setUser: (user) => set({ user }),
  setSurvey: (survey) => set({ survey }),

  addAnswer: (answer) =>
    set((state) => ({
      answers: [...state.answers.filter((a) => a.question_id !== answer.question_id), answer],
    })),

  updateAnswer: (questionId, answer) =>
    set((state) => ({
      answers: state.answers.map((a) =>
        a.question_id === questionId ? answer : a
      ),
    })),

  setCurrentStep: (currentStep) => set({ currentStep }),

  reset: () =>
    set({
      user: null,
      survey: null,
      answers: [],
      currentStep: 0,
    }),
}));
