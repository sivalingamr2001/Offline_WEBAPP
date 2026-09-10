import { toast as sonnerToast } from "sonner"

interface ToastOptions {
    title?: string
    description?: string
}

export function useToast() {
    return {
        toast: ({ title, description }: ToastOptions) =>
            sonnerToast(title, { description }),
    }
}
