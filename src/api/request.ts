export async function parseApiError(response: Response): Promise<Error> {
    let message = `Request failed (${response.status})`
    try {
        const body = (await response.json()) as { message?: string; error?: string }
        message = body.message || body.error || message
    } catch {
        // Keep the HTTP status when the API response is not JSON.
    }
    return new Error(message)
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        credentials: "include",
        ...options,
    })
    if (!response.ok) throw await parseApiError(response)
    return (await response.json()) as T
}
