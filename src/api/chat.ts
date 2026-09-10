import { parseApiError } from "./request"

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
) {
    const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ message, session_id: sessionId, model, attachment }),
    })
    if (!response.ok) throw await parseApiError(response)
    if (!response.body) throw new Error("The API returned an empty response stream")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ChatEvent)
        if (done) break
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatEvent)
}
