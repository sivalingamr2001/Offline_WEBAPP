import { apiRequest } from "./request"
import type { Message } from "@/types/chat"
import { MOCK_SESSIONS } from "./mock-data"

export interface ChatSession {
    session_id: string
    title: string
    updated_at?: string
    messages: Array<Message | { role: string; content: string }>
}

let localSessions: ChatSession[] = [...MOCK_SESSIONS]

export async function startSession(existingSessionId?: string): Promise<{ session_id: string }> {
    try {
        return await apiRequest<{ session_id: string }>("/api/start-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(existingSessionId ? { existing_session_id: existingSessionId } : {}),
        })
    } catch {
        const id = existingSessionId || `session-${Date.now()}`
        if (!localSessions.some((s) => s.session_id === id)) {
            localSessions.unshift({
                session_id: id,
                title: "New conversation",
                updated_at: new Date().toISOString(),
                messages: [],
            })
        }
        return { session_id: id }
    }
}

export async function getHistory(): Promise<{ histroy: ChatSession[] }> {
    try {
        const response = await apiRequest<{ histroy: ChatSession[] }>("/api/get_history")
        const formatted = response.histroy.map((conversation) => {
            const firstUserMessage = conversation.messages.find(
                (message): message is { role: string; content: string } =>
                    "role" in message && message.role === "user" && typeof message.content === "string",
            )
            return {
                ...conversation,
                title: conversation.title?.trim() || firstUserMessage?.content.trim() || "New conversation",
            }
        })
        if (formatted.length === 0) {
            return { histroy: localSessions }
        }
        return { histroy: formatted }
    } catch {
        return { histroy: localSessions }
    }
}

export async function deleteSession(sessionId: string): Promise<{ status: string }> {
    localSessions = localSessions.filter((s) => s.session_id !== sessionId)
    try {
        return await apiRequest<{ status: string }>("/api/delete_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
        })
    } catch {
        return { status: "success" }
    }
}

export async function renameSession(sessionId: string, newTitle: string): Promise<{ status: string }> {
    const session = localSessions.find((s) => s.session_id === sessionId)
    if (session) {
        session.title = newTitle.trim() || "New conversation"
    }
    try {
        return await apiRequest<{ status: string }>("/api/rename_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, title: newTitle }),
        })
    } catch {
        return { status: "success" }
    }
}

export async function saveSearch(searchQuery: string, response: string, sessionId: string, fileUrl?: string | null) {
    const session = localSessions.find((s) => s.session_id === sessionId)
    if (session) {
        if (session.title === "New conversation") {
            session.title = searchQuery.trim().slice(0, 45) || "New conversation"
        }
    }
    try {
        return await apiRequest<{ status: string; id: number }>("/api/save_search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ search_query: searchQuery, response, session: sessionId, file_url: fileUrl }),
        })
    } catch {
        return { status: "success", id: Date.now() }
    }
}
