"use client"

import { useState, useRef, useEffect } from "react"
import {
    ArrowUp,
    Brain,
    FileText,
    Mic,
    MicOff,
    Paperclip,
    Square,
    X,
    UploadCloud,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { uploadFile, type Attachment } from "@/api/attachments"
import { toast } from "sonner"

interface ComposerProps {
    onSend: (text: string, attachment: Attachment | null) => void
    onStop?: () => void
    isGenerating?: boolean
    activeModel: string
    setActiveModel: (model: string) => void
    initialPrompt?: string
    onClearInitialPrompt?: () => void
}

export function Composer({
    onSend,
    onStop,
    isGenerating = false,
    activeModel,
    setActiveModel,
    initialPrompt,
    onClearInitialPrompt,
}: ComposerProps) {
    const [input, setInput] = useState("")
    const [isListening, setIsListening] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [attachment, setAttachment] = useState<Attachment | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Populate initial prompt if requested (e.g. from clicking suggestion cards)
    useEffect(() => {
        if (initialPrompt) {
            setInput(initialPrompt)
            onClearInitialPrompt?.()
            textareaRef.current?.focus()
        }
    }, [initialPrompt, onClearInitialPrompt])

    // Auto-grow textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
        }
    }, [input])

    // Process a file from picker, drag & drop, or screenshot paste
    const processFile = async (file: File) => {
        setIsUploading(true)
        try {
            const uploaded = await uploadFile(file)
            setAttachment(uploaded)
            toast.success(
                file.type.startsWith("image/")
                    ? "Screenshot / Image attached"
                    : `Attached ${file.name}`
            )
        } catch {
            toast.error("Failed to attach file")
        } finally {
            setIsUploading(false)
        }
    }

    // Handle Ctrl+V / Cmd+V screenshot paste
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile()
                if (file) {
                    e.preventDefault()
                    void processFile(file)
                    return
                }
            }
        }
    }

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            void processFile(e.dataTransfer.files[0])
        }
    }

    const handleSend = () => {
        if (isGenerating) {
            onStop?.()
            return
        }

        const trimmed = input.trim()
        if (!trimmed && !attachment) return

        onSend(trimmed || (attachment ? `Attached: ${attachment.filename}` : ""), attachment)
        setInput("")
        setAttachment(null)

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleVoiceToggle = () => {
        setIsListening(!isListening)
        if (!isListening) {
            toast.info("Voice Mode Activated - Speak your prompt")
        } else {
            toast.info("Voice Mode Stopped")
        }
    }

    const isSendDisabled = !input.trim() && !attachment && !isGenerating

    return (
        <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 md:px-8"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="pointer-events-auto mx-auto w-full max-w-4xl xl:max-w-5xl">
                {/* Drag overlay state */}
                {isDragging && (
                    <div className="mb-2 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/90 py-4 text-sm font-semibold text-blue-700 backdrop-blur-sm dark:bg-blue-950/80 dark:text-blue-300">
                        <UploadCloud className="size-5 animate-bounce" />
                        <span>Drop your screenshot or document here</span>
                    </div>
                )}

                {/* Staged Attachment Preview Chip */}
                {attachment && (
                    <div className="mb-2 flex items-center gap-3 self-start rounded-2xl border border-stone-200/90 bg-white/95 p-2 shadow-lg backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95">
                        {attachment.data_url || attachment.file_url ? (
                            <img
                                src={attachment.data_url || attachment.file_url || ""}
                                alt={attachment.filename}
                                className="size-12 rounded-xl object-cover"
                            />
                        ) : (
                            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                <FileText className="size-6" />
                            </div>
                        )}
                        <div className="min-w-0 pr-2">
                            <p className="truncate text-xs font-semibold text-stone-800 dark:text-stone-200">
                                {attachment.filename}
                            </p>
                            <span className="text-[10px] text-stone-400">
                                {attachment.type === "image" ? "Image attachment" : "Document"}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAttachment(null)}
                            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                            title="Remove attachment"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )}

                {/* Main Composer Box */}
                <div className="relative rounded-3xl border border-stone-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md transition-shadow focus-within:border-stone-300 focus-within:shadow-2xl dark:border-stone-800 dark:bg-stone-900/95 dark:focus-within:border-stone-700">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={
                            isListening
                                ? "Listening to audio..."
                                : "Ask J-CHAT anything... (Paste screenshots with ⌘V / Ctrl+V)"
                        }
                        rows={1}
                        className="max-h-44 w-full resize-none bg-transparent px-2 pt-1 pb-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100 dark:placeholder:text-stone-500"
                    />

                    {/* Bottom Action Bar */}
                    <div className="mt-1 flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                            {/* File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => {
                                    if (e.target.files?.[0]) void processFile(e.target.files[0])
                                }}
                                className="hidden"
                                accept="image/*,.pdf,.txt"
                            />

                            {/* Attach Button */}
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="size-8 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                                title="Attach file or screenshot"
                            >
                                <Paperclip className="size-4" />
                            </Button>

                            {/* Model Selector Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-200/80 focus:outline-none dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                                    >
                                        <Brain className="size-3.5 text-blue-500" />
                                        <span>{activeModel}</span>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    side="top"
                                    className="w-44 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-800 dark:bg-stone-900"
                                >
                                    {["Gemini", "GPT-4o", "Claude 3.5"].map((model) => (
                                        <DropdownMenuItem
                                            key={model}
                                            onClick={() => setActiveModel(model)}
                                            className="cursor-pointer rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                                        >
                                            {model}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Voice Button */}
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={handleVoiceToggle}
                                className={`size-8 rounded-full transition-colors ${
                                    isListening
                                        ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400"
                                        : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                                }`}
                                title={isListening ? "Pause voice mode" : "Activate voice mode"}
                            >
                                {isListening ? (
                                    <MicOff className="size-4 animate-bounce" />
                                ) : (
                                    <Mic className="size-4" />
                                )}
                            </Button>
                        </div>

                        {/* Send or Stop Generating Button */}
                        {isGenerating ? (
                            <Button
                                type="button"
                                size="icon"
                                onClick={onStop}
                                className="size-8 rounded-full bg-stone-900 text-white shadow-sm hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
                                title="Stop generating (Esc)"
                            >
                                <Square className="size-3.5 fill-current" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="icon"
                                disabled={isSendDisabled}
                                onClick={handleSend}
                                className="size-8 rounded-full bg-stone-900 text-white shadow-sm transition-all hover:bg-stone-800 disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
                                title="Send message (Enter)"
                            >
                                <ArrowUp className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <p className="mt-2 text-center text-[11px] text-stone-400 dark:text-stone-500">
                    J-CHAT can make mistakes. Verify critical industrial &amp; engineering information.
                </p>
            </div>
        </div>
    )
}
