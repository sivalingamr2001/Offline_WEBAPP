import { apiRequest } from "./request"

export interface AuthUser {
    id: string
    username: string
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
    })
}

export function getCurrentUser() {
    return apiRequest<AuthUser>("/api/me")
}

export function logout() {
    return apiRequest<{ status: string }>("/api/logout", { method: "POST" })
}
