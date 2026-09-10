"use client"

import { useEffect, useRef } from "react"
import { MessageBubble } from "./message-bubble"
import {
    Code2,
    Database,
    FileSpreadsheet,
    Menu,
    Sparkles,
    Square,
    Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Message } from "@/types/chat"
import { PROMPT_SUGGESTIONS } from "@/api/mock-data"
import janaticsLogo from "@/assets/logo.png"

interface ChatWindowProps {
    messages: Message[]
    isLoading: boolean
    activeSessionTitle?: string
    activeModel?: string
    onToggleSidebar: () => void
    onSelectPrompt: (promptText: string) => void
    onRegenerate?: (messageId: string) => void
    onThumbsDown?: (messageId: string) => void
    onStop?: () => void
}

const ICONS_MAP: Record<string, React.ReactNode> = {
    screenshot: <FileSpreadsheet className="size-4 text-blue-500" />,
    sql: <Database className="size-4 text-emerald-500" />,
    troubleshoot: <Wrench className="size-4 text-amber-500" />,
    spec: <Code2 className="size-4 text-purple-500" />,
}

export function ChatWindow({
    messages,
    isLoading,
    activeSessionTitle,
    activeModel = "Gemini",
    onToggleSidebar,
    onSelectPrompt,
    onRegenerate,
    onThumbsDown,
    onStop,
}: ChatWindowProps) {
    const bottomRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom as messages stream or are added
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isLoading])

    // Find the last assistant message ID for regeneration
    const lastAssistantMessage = [...messages].reverse().find((m) => m.sender === "assistant")

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden">
            {/* Fixed Dedicated Top App Header */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200/80 bg-white/95 px-6 backdrop-blur-md dark:border-stone-800 dark:bg-[#0e0f14]/95">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-xl text-stone-600 hover:bg-stone-100 md:hidden dark:text-stone-300 dark:hover:bg-stone-800 shrink-0"
                        onClick={onToggleSidebar}
                        aria-label="Toggle sidebar"
                    >
                        <Menu className="size-5" />
                    </Button>

                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="truncate text-sm font-semibold tracking-tight text-stone-800 dark:text-stone-200">
                            {activeSessionTitle || "J-CHAT"}
                        </span>
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                            {activeModel}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <img
                        src={janaticsLogo}
                        alt="JANATICS"
                        className="h-6 w-auto object-contain transition-opacity hover:opacity-100"
                    />
                </div>
            </header>

            {/* Scrollable Chat Area */}
            <div
                className="relative flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pt-6 pb-44 selection:bg-blue-100 dark:selection:bg-blue-900"
                role="log"
                aria-label="Chat logs"
            >
                {/* Empty State vs Message Thread */}
                {messages.length === 0 ? (
                    <div className="mx-auto flex h-full min-h-[65dvh] max-w-3xl xl:max-w-4xl flex-col items-center justify-center text-center">
                        {/* J-CHAT Avatar Emblem */}
                        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                            <Sparkles className="size-7" />
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
                            How can I help you today?
                        </h1>
                        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                            Ask questions, analyze telemetry errors, write queries, or paste screenshots.
                        </p>

                        {/* 4 Interactive Prompt Suggestions Cards */}
                        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 text-left">
                            {PROMPT_SUGGESTIONS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSelectPrompt(item.prompt)}
                                    className="group flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:border-blue-500"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-7 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800">
                                            {ICONS_MAP[item.id] || <Sparkles className="size-3.5 text-blue-500" />}
                                        </div>
                                        <span className="text-xs font-semibold text-stone-800 group-hover:text-blue-600 dark:text-stone-200 dark:group-hover:text-blue-400">
                                            {item.title}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
                                        {item.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto w-full max-w-4xl xl:max-w-5xl space-y-6 pt-2">
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isLastAssistant={msg.id === lastAssistantMessage?.id}
                                onRegenerate={onRegenerate}
                                onThumbsDown={onThumbsDown}
                            />
                        ))}

                        {/* Floating Stop Generating Pill while loading */}
                        {isLoading && onStop && (
                            <div className="flex justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={onStop}
                                    className="flex items-center gap-2 rounded-full border border-stone-300 bg-white/95 px-4 py-1.5 text-xs font-semibold text-stone-700 shadow-md backdrop-blur-sm transition-all hover:bg-stone-100 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-300 dark:hover:bg-stone-800"
                                >
                                    <Square className="size-3 fill-current text-red-500" />
                                    <span>Stop generating (Esc)</span>
                                </button>
                            </div>
                        )}

                        <div ref={bottomRef} className="h-4" />
                    </div>
                )}
            </div>
        </div>
    )
}
