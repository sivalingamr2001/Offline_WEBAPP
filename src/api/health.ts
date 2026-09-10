import { apiRequest } from "./request"

export function getHealth() {
    return apiRequest<{ status: string }>("/api/health")
}

export function getWelcome() {
    return apiRequest<{ name: string; description: string; login_url: string; app_url: string }>("/api/welcome")
}
