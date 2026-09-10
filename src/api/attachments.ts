import { apiRequest } from "./request"

export interface Attachment {
    type: "image" | "document"
    filename: string
    file_type: string
    data_url?: string
    content?: string
    file_url?: string | null
}

export function uploadFile(file: File) {
    const form = new FormData()
    form.append("file", file)
    return apiRequest<Attachment & { status: string }>("/api/upload_file", {
        method: "POST",
        body: form,
    })
}
