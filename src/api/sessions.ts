import { apiRequest } from "./request"
import type { Message } from "@/types/chat"

export interface ChatSession {
    session_id: string
    title: string
    messages: Array<Message | { role: string; content: string }>
}

export function startSession(existingSessionId?: string) {
    return apiRequest<{ session_id: string }>("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existingSessionId ? { existing_session_id: existingSessionId } : {}),
    })
}

export function getHistory() {
    return apiRequest<{ histroy: ChatSession[] }>("/api/get_history").then((response) => ({
        ...response,
        histroy: response.histroy.map((conversation) => {
            const firstUserMessage = conversation.messages.find(
                (message): message is { role: string; content: string } =>
                    "role" in message && message.role === "user" && typeof message.content === "string",
            )
            return {
                ...conversation,
                title: conversation.title?.trim() || firstUserMessage?.content.trim() || "New conversation",
            }
        }),
    }))
}

export function deleteSession(sessionId: string) {
    return apiRequest<{ status: string }>("/api/delete_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
    })
}

export function saveSearch(searchQuery: string, response: string, sessionId: string, fileUrl?: string | null) {
    return apiRequest<{ status: string; id: number }>("/api/save_search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_query: searchQuery, response, session: sessionId, file_url: fileUrl }),
    })
}
