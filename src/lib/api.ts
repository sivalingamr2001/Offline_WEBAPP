export interface LoginResponse {
    status: string
    user: {
        id: string
        username: string
        department: string | null
        jchat_flag: number | string | null
    }
}

export interface ChatEvent {
    type: "meta" | "token" | "done" | "error" | "image_generated" | "file_ready"
    content?: string
    message?: string
    url?: string
    session_id?: string
}

async function parseError(response: Response): Promise<Error> {
    let message = `Request failed (${response.status})`
    try {
        const body = (await response.json()) as { message?: string; error?: string }
        message = body.message || body.error || message
    } catch {
        // Keep the HTTP status when the server did not return JSON.
    }
    return new Error(message)
}

export async function login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    })
    if (!response.ok) throw await parseError(response)
    return (await response.json()) as LoginResponse
}

export async function streamChat(
    message: string,
    sessionId: string,
    model: string,
    onEvent: (event: ChatEvent) => void
): Promise<void> {
    const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ message, session_id: sessionId, model }),
    })
    if (!response.ok) throw await parseError(response)
    if (!response.body) throw new Error("The API returned an empty response stream")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
            if (line.trim()) onEvent(JSON.parse(line) as ChatEvent)
        }
        if (done) break
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer) as ChatEvent)
}
