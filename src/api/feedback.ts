import { apiRequest } from "./request"

export interface FeedbackPayload {
    user: string
    sessionId: string
    messageId: string
    feedbackType: "Incorrect answer" | "Not relevant" | "Poor response" | "Missing information" | "Other"
    comment?: string
    model: string
    timestamp: string
}

export interface FeedbackResponse {
    status: string
    id?: string | number
    mock?: boolean
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
    try {
        return await apiRequest<FeedbackResponse>("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
    } catch {
        // Graceful fallback for offline / mock testing
        try {
            const existing = JSON.parse(localStorage.getItem("jchat_feedback_log") || "[]") as FeedbackPayload[]
            existing.push(payload)
            localStorage.setItem("jchat_feedback_log", JSON.stringify(existing))
        } catch {
            // Ignore storage errors
        }
        return { status: "success", mock: true }
    }
}
