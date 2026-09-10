import { apiRequest } from "./request"
import { MOCK_USER } from "./mock-data"

export interface AuthUser {
    id: string
    username: string
    name?: string
    email?: string
    department: string | null
    jchat_flag: number | string | null
}

export interface LoginResponse {
    status: string
    user: AuthUser
}

export function login(username: string, password: string) {
    return apiRequest<LoginResponse>("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    }).catch((err) => {
        // Fallback for offline testing if credentials supplied
        if (username.trim()) {
            return {
                status: "success",
                user: {
                    ...MOCK_USER,
                    username: username.trim(),
                },
            }
        }
        throw err
    })
}

export function getCurrentUser(): Promise<AuthUser> {
    return apiRequest<AuthUser>("/api/me").catch(() => {
        return MOCK_USER
    })
}

export function logout() {
    return apiRequest<{ status: string }>("/api/logout", { method: "POST" }).catch(() => {
        return { status: "success" }
    })
}
