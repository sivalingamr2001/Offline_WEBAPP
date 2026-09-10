export interface Message {
    id: string
    sender: "user" | "assistant"
    text: string
    timestamp: string
    attachment?: {
        filename: string
        file_type: string
    }
}