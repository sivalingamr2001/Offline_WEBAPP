"use client"

import { useState } from "react"
import type { Message } from "@/types/chat"
import { MarkdownRenderer } from "./markdown-renderer"
import { Check, Copy, FileText, RotateCw, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react"
import { toast } from "sonner"

interface MessageBubbleProps {
    message: Message
    onRegenerate?: (messageId: string) => void
    onThumbsDown?: (messageId: string) => void
    isLastAssistant?: boolean
}

export function MessageBubble({
    message,
    onRegenerate,
    onThumbsDown,
    isLastAssistant,
}: MessageBubbleProps) {
    const isUser = message.sender === "user"
    const [copied, setCopied] = useState(false)
    const [liked, setLiked] = useState<boolean | null>(null)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.text)
            setCopied(true)
            toast.success("Response copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy response")
        }
    }

    const handleLike = () => {
        if (liked === true) {
            setLiked(null)
        } else {
            setLiked(true)
            toast.success("Thanks for the feedback!")
        }
    }

    const handleDislike = () => {
        setLiked(false)
        onThumbsDown?.(message.id)
    }

    return (
        <div
            className={`group relative flex w-full items-start gap-3.5 sm:gap-4 ${
                isUser ? "flex-row-reverse" : "flex-row"
            }`}
        >
            {/* Avatar */}
            {isUser ? (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-stone-200 text-stone-700 shadow-xs dark:bg-stone-800 dark:text-stone-300">
                    <User className="size-4" />
                </div>
            ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                    <Sparkles className="size-4" />
                </div>
            )}

            {/* Bubble Container */}
            <div
                className={`flex flex-col ${
                    isUser ? "max-w-[85%] sm:max-w-[75%] items-end" : "w-full min-w-0 max-w-full items-start"
                }`}
            >
                {/* Meta header with timestamp on hover */}
                <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-stone-400 opacity-80 transition-opacity group-hover:opacity-100">
                    <span className="font-semibold text-stone-600 dark:text-stone-400">
                        {isUser ? "You" : "J-CHAT"}
                    </span>
                    {message.timestamp && (
                        <span>• {message.timestamp}</span>
                    )}
                </div>

                {/* Attachment Preview if attached by user */}
                {message.attachment && (
                    <div className="mb-2 max-w-sm overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-2 dark:border-stone-800 dark:bg-stone-800/60">
                        {message.attachment.data_url || message.attachment.file_url ? (
                            <img
                                src={message.attachment.data_url || message.attachment.file_url || ""}
                                alt={message.attachment.filename}
                                className="max-h-56 rounded-lg object-contain"
                            />
                        ) : (
                            <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-stone-700 dark:text-stone-300">
                                <FileText className="size-4 text-blue-500" />
                                <span className="truncate">{message.attachment.filename}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Message Body */}
                <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs transition-colors ${
                        isUser
                            ? "rounded-tr-xs bg-blue-600 text-white selection:bg-blue-800"
                            : "w-full rounded-tl-xs border border-stone-200/80 bg-white text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
                    }`}
                >
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{message.text}</p>
                    ) : (
                        <MarkdownRenderer
                            content={message.text}
                            isStreaming={message.isStreaming}
                        />
                    )}
                </div>

                {/* Action Bar for Assistant Responses */}
                {!isUser && !message.isStreaming && message.text && (
                    <div className="mt-2 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex items-center gap-1 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                            title="Copy response"
                        >
                            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        </button>

                        {isLastAssistant && onRegenerate && (
                            <button
                                type="button"
                                onClick={() => onRegenerate(message.id)}
                                className="flex items-center gap-1 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                                title="Regenerate response"
                            >
                                <RotateCw className="size-3.5" />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleLike}
                            className={`rounded-lg p-1.5 transition-colors ${
                                liked === true
                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                                    : "text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                            }`}
                            title="Good response"
                        >
                            <ThumbsUp className={`size-3.5 ${liked === true ? "fill-current" : ""}`} />
                        </button>

                        <button
                            type="button"
                            onClick={handleDislike}
                            className={`rounded-lg p-1.5 transition-colors ${
                                liked === false
                                    ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                                    : "text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                            }`}
                            title="Bad response (Provide feedback)"
                        >
                            <ThumbsDown className={`size-3.5 ${liked === false ? "fill-current" : ""}`} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
