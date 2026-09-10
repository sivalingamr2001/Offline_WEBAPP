import { apiRequest } from "./request"

export interface Attachment {
    type: "image" | "document"
    filename: string
    file_type: string
    data_url?: string
    content?: string
    file_url?: string | null
}

export async function uploadFile(file: File): Promise<Attachment & { status: string }> {
    const isImage = file.type.startsWith("image/")
    const form = new FormData()
    form.append("file", file)

    try {
        return await apiRequest<Attachment & { status: string }>("/api/upload_file", {
            method: "POST",
            body: form,
        })
    } catch {
        // Create data URL fallback for offline and local testing
        const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => resolve("")
            reader.readAsDataURL(file)
        })

        return {
            status: "success",
            type: isImage ? "image" : "document",
            filename: file.name,
            file_type: file.type,
            data_url: dataUrl,
            file_url: dataUrl,
        }
    }
}
