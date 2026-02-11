export interface AiEmailContext {
  sender: string;
  senderEmail: string;
  subject: string;
  body: string;
  emailId?: string;          // Original message ID (Gmail message ID / Outlook message ID)
  threadId?: string;         // Gmail threadId for reply threading
  conversationId?: string;   // Outlook conversationId for reply threading
}

export interface AiStep1Result {
  summary: string;
  extractedTodos: string[];
  suggestedActions: {
    label: string;
    prompt: string;
  }[];
}

export interface AiStep2Result {
  replySubject: string;
  draftReply: string;
}

export interface AiStep3Result {
  todoCandidates: {
    text: string;
    notes?: string;
  }[];
  calendarCandidates: {
    title: string;
    date: string;
    startTime: string;
    endTime?: string;
  }[];
  checks: {
    type: "typo" | "keigo" | "missing_info";
    message: string;
    suggestion?: string;
  }[];
}

export type AiWorkflowStep =
  | "idle"
  | "step1-loading"
  | "step1"
  | "step2-loading"
  | "step2"
  | "step3-loading"
  | "step3";

export interface AiWorkflowState {
  step: AiWorkflowStep;
  emailContext: AiEmailContext | null;
  step1Result: AiStep1Result | null;
  selectedAction: string | null;
  step2Result: AiStep2Result | null;
  editedDraft: string | null;
  editedSubject: string | null;
  step3Result: AiStep3Result | null;
  error: string | null;
}

export interface AiApiRequest {
  step: 1 | 2 | 3;
  emailContext: AiEmailContext;
  selectedAction?: string;
  step1Result?: AiStep1Result;
  editedDraft?: string;
  step2Result?: AiStep2Result;
}

export interface AiApiResponse {
  step1?: AiStep1Result;
  step2?: AiStep2Result;
  step3?: AiStep3Result;
  error?: string;
}

export const AI_INITIAL_STATE: AiWorkflowState = {
  step: "idle",
  emailContext: null,
  step1Result: null,
  selectedAction: null,
  step2Result: null,
  editedDraft: null,
  editedSubject: null,
  step3Result: null,
  error: null,
};
