export interface Message {
    id: string
    sender: "user" | "assistant"
    text: string
    timestamp: string
    isStreaming?: boolean
    attachment?: {
        filename: string
        file_type: string
        data_url?: string
        file_url?: string | null
    }
}