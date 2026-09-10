import { parseApiError } from "./request"
import { getMockAIResponse } from "./mock-data"

export interface ChatEvent {
    type: "meta" | "token" | "done" | "error" | "image_generated" | "file_ready"
    content?: string
    message?: string
    url?: string
    session_id?: string
}

export async function streamChat(
    message: string,
    sessionId: string,
    model: string,
    attachment: unknown,
    onEvent: (event: ChatEvent) => void,
    signal?: AbortSignal,
) {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
            body: JSON.stringify({ message, session_id: sessionId, model, attachment }),
            signal,
        })
        if (!response.ok) throw await parseApiError(response)
        if (!response.body) throw new Error("The API returned an empty response stream")

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (true) {
            if (signal?.aborted) {
                void reader.cancel()
                break
            }
            const { value, done } = await reader.read()
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""
            for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ChatEvent)
            if (done) break
        }
        if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatEvent)
    } catch (err: unknown) {
        if (signal?.aborted) {
            onEvent({ type: "done" })
            return
        }
        // Fall back to offline mock token streaming with realistic timing
        console.warn("Backend /api/chat unreachable, falling back to simulated streaming:", err)
        const mockText = getMockAIResponse(message)
        const chunks = mockText.match(/.{1,6}/g) || [mockText]
        onEvent({ type: "meta", session_id: sessionId })
        for (const chunk of chunks) {
            if (signal?.aborted) break
            await new Promise((resolve) => setTimeout(resolve, 20))
            if (signal?.aborted) break
            onEvent({ type: "token", content: chunk })
        }
        onEvent({ type: "done" })
    }
}
