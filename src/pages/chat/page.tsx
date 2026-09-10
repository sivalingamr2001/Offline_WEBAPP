"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { streamChat } from "@/api/chat"
import type { Attachment } from "@/api/attachments"
import {
    getHistory,
    saveSearch,
    startSession,
    deleteSession,
    renameSession,
    type ChatSession,
} from "@/api/sessions"
import { getCurrentUser, logout, type AuthUser } from "@/api/auth"
import { MOCK_USER } from "@/api/mock-data"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { Composer } from "@/components/chat/composer"
import { FeedbackDialog } from "@/components/chat/feedback-dialog"
import { SettingsDialog } from "@/components/chat/settings-dialog"
import type { Message } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ChatPageProps {
    onLogout: () => void
}

export default function JarvisChatPage({ onLogout }: ChatPageProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [activeModel, setActiveModel] = useState("Gemini")
    const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [user, setUser] = useState<AuthUser>(MOCK_USER)

    // Dialog states
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [feedbackModal, setFeedbackModal] = useState<{
        isOpen: boolean
        messageId: string
    }>({ isOpen: false, messageId: "" })

    // Prompt staging for suggestion clicks
    const [stagedPrompt, setStagedPrompt] = useState<string>("")

    // Abort controller for Stop Generating
    const abortControllerRef = useRef<AbortController | null>(null)

    // Helper: format backend messages to frontend messages
    const toMessages = useCallback(
        (selectedSessionId: string, history: Array<Message | { role: string; content: string }>): Message[] =>
            history.flatMap((item, index) => {
                if ("sender" in item && "text" in item) {
                    return [item]
                }
                if ("role" in item && (item.role === "user" || item.role === "assistant")) {
                    return [
                        {
                            id: `${selectedSessionId}-${index}`,
                            sender: item.role as Message["sender"],
                            text: item.content,
                            timestamp: "",
                        },
                    ]
                }
                return []
            }),
        []
    )

    // Load user and sessions on mount
    useEffect(() => {
        const initData = async () => {
            try {
                const currentUser = await getCurrentUser()
                setUser(currentUser)
            } catch {
                setUser(MOCK_USER)
            }

            try {
                const { histroy } = await getHistory()
                setSessions(histroy)
                if (histroy.length > 0) {
                    const first = histroy[0]
                    setSessionId(first.session_id)
                    setMessages(toMessages(first.session_id, first.messages))
                }
            } catch {
                // Fallback creates a usable local session
                setSessionId(crypto.randomUUID())
            }
        }
        void initData()
    }, [toMessages])

    // Handle Starting a New Chat
    const handleNewChat = useCallback(async () => {
        if (isLoading) {
            abortControllerRef.current?.abort()
            setIsLoading(false)
        }
        try {
            const { session_id } = await startSession()
            setSessionId(session_id)
            setMessages([])
            setIsSidebarOpen(false)
        } catch {
            const fallbackId = crypto.randomUUID()
            setSessionId(fallbackId)
            setMessages([])
            setIsSidebarOpen(false)
        }
    }, [isLoading])

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey

            // ⌘/Ctrl + K: Focus conversation search
            if (isMod && e.key.toLowerCase() === "k") {
                e.preventDefault()
                setIsSidebarOpen(true)
                const searchInput = document.querySelector('input[placeholder*="Search conversations"]') as HTMLInputElement | null
                searchInput?.focus()
            }

            // ⌘/Ctrl + Shift + O: New chat
            if (isMod && e.shiftKey && e.key.toLowerCase() === "o") {
                e.preventDefault()
                void handleNewChat()
            }

            // ⌘/Ctrl + /: Focus composer
            if (isMod && e.key === "/") {
                e.preventDefault()
                const composerInput = document.querySelector('textarea[placeholder*="Ask J-CHAT"]') as HTMLTextAreaElement | null
                composerInput?.focus()
            }

            // Escape: Stop generation or close modals
            if (e.key === "Escape") {
                if (isLoading) {
                    abortControllerRef.current?.abort()
                    setIsLoading(false)
                    toast.info("Generation stopped")
                } else if (feedbackModal.isOpen) {
                    setFeedbackModal({ isOpen: false, messageId: "" })
                } else if (isSettingsOpen) {
                    setIsSettingsOpen(false)
                } else if (isHelpOpen) {
                    setIsHelpOpen(false)
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [handleNewChat, isLoading, feedbackModal.isOpen, isSettingsOpen, isHelpOpen])

    // Handle Stop Generating
    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setIsLoading(false)
        setMessages((prev) =>
            prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
        )
        toast.info("Generation stopped")
    }

    // Handle Sending a Message
    const handleSendMessage = async (text: string, attachment: Attachment | null) => {
        const timestamp = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })

        const userMsg: Message = {
            id: `usr-${Date.now()}`,
            sender: "user",
            text,
            timestamp,
            attachment: attachment
                ? {
                      filename: attachment.filename,
                      file_type: attachment.file_type,
                      data_url: attachment.data_url,
                      file_url: attachment.file_url,
                  }
                : undefined,
        }

        setMessages((prev) => [...prev, userMsg])
        setIsLoading(true)

        const assistantId = `ast-${Date.now()}`
        setMessages((prev) => [
            ...prev,
            { id: assistantId, sender: "assistant", text: "", timestamp, isStreaming: true },
        ])

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const modelKey = activeModel === "GPT-4o" ? "gpt-4o" : activeModel === "Claude 3.5" ? "claude-3-5-sonnet" : "gemini-2.5-flash"
            let assistantText = ""

            await streamChat(
                text,
                sessionId,
                modelKey,
                attachment,
                (event) => {
                    if (event.type === "token" && event.content) {
                        assistantText += event.content
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantId
                                    ? { ...msg, text: msg.text + event.content, isStreaming: true }
                                    : msg
                            )
                        )
                    }
                    if (event.type === "done") {
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantId ? { ...msg, isStreaming: false } : msg
                            )
                        )
                    }
                    if (event.type === "error") {
                        throw new Error(event.message || "Chat request failed")
                    }
                },
                controller.signal
            )

            void saveSearch(text, assistantText, sessionId, attachment?.file_url).catch(() => undefined)

            // Update session title in sidebar
            setSessions((prev) => {
                const existing = prev.find((s) => s.session_id === sessionId)
                if (existing) {
                    if (existing.title === "New conversation") {
                        return prev.map((s) =>
                            s.session_id === sessionId
                                ? { ...s, title: text.slice(0, 45) }
                                : s
                        )
                    }
                    return prev
                }
                return [
                    {
                        session_id: sessionId,
                        title: text.slice(0, 45) || "New conversation",
                        updated_at: new Date().toISOString(),
                        messages: [userMsg, { id: assistantId, sender: "assistant", text: assistantText, timestamp }],
                    },
                    ...prev,
                ]
            })
        } catch (cause) {
            if (controller.signal.aborted) return
            const message = cause instanceof Error ? cause.message : "Chat request failed"
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, text: message, isStreaming: false } : msg
                )
            )
        } finally {
            setIsLoading(false)
            abortControllerRef.current = null
        }
    }

    // Handle Regenerate Response
    const handleRegenerate = async (messageId: string) => {
        // Find the index of the message to regenerate
        const targetIndex = messages.findIndex((m) => m.id === messageId)
        if (targetIndex <= 0) return

        // Look back for the preceding user message
        const lastUserMsg = [...messages.slice(0, targetIndex)]
            .reverse()
            .find((m) => m.sender === "user")

        if (!lastUserMsg) return

        // Remove the old assistant answer and re-send
        setMessages((prev) => prev.slice(0, targetIndex))
        await handleSendMessage(
            lastUserMsg.text,
            lastUserMsg.attachment
                ? {
                      type: lastUserMsg.attachment.file_type.startsWith("image/") ? "image" : "document",
                      filename: lastUserMsg.attachment.filename,
                      file_type: lastUserMsg.attachment.file_type,
                      data_url: lastUserMsg.attachment.data_url,
                      file_url: lastUserMsg.attachment.file_url,
                  }
                : null
        )
    }

    // Handle Thumbs Down
    const handleThumbsDown = (messageId: string) => {
        setFeedbackModal({ isOpen: true, messageId })
    }

    // Handle Select Session from Sidebar
    const handleSelectSession = (selectedSessionId: string) => {
        if (isLoading) {
            abortControllerRef.current?.abort()
            setIsLoading(false)
        }
        const selected = sessions.find((item) => item.session_id === selectedSessionId)
        if (!selected) return

        setSessionId(selectedSessionId)
        setMessages(toMessages(selectedSessionId, selected.messages))
    }

    // Handle Rename Session
    const handleRenameSession = async (sessionIdToRename: string, newTitle: string) => {
        setSessions((prev) =>
            prev.map((s) =>
                s.session_id === sessionIdToRename ? { ...s, title: newTitle } : s
            )
        )
        try {
            await renameSession(sessionIdToRename, newTitle)
            toast.success("Conversation renamed")
        } catch {
            // Keep local rename
        }
    }

    // Handle Delete Session
    const handleDeleteSession = async (sessionIdToDelete: string) => {
        setSessions((prev) => prev.filter((s) => s.session_id !== sessionIdToDelete))
        try {
            await deleteSession(sessionIdToDelete)
            toast.success("Conversation deleted")
            if (sessionId === sessionIdToDelete) {
                void handleNewChat()
            }
        } catch {
            toast.error("Failed to delete conversation")
        }
    }

    // Handle Logout
    const handleLogout = async () => {
        try {
            await logout()
        } finally {
            onLogout()
        }
    }

    return (
        <div className="relative flex h-dvh w-screen overflow-hidden bg-[#fafafa] antialiased selection:bg-blue-100 dark:bg-[#0b0c10] dark:selection:bg-blue-900">
            {/* Sidebar with Search, Groups, and User Profile */}
            <Sidebar
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                sessions={sessions}
                activeSessionId={sessionId}
                onSelectSession={handleSelectSession}
                onHelp={() => setIsHelpOpen(true)}
                onLogout={() => void handleLogout()}
                onNewChat={() => void handleNewChat()}
                onRenameSession={(id, title) => void handleRenameSession(id, title)}
                onDeleteSession={(id) => void handleDeleteSession(id)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                user={user}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />

            {/* Main Chat Stage */}
            <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-white dark:bg-[#0e0f14]">
                <ChatWindow
                    messages={messages}
                    isLoading={isLoading}
                    activeSessionTitle={sessions.find((s) => s.session_id === sessionId)?.title}
                    activeModel={activeModel}
                    onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
                    onSelectPrompt={(p) => setStagedPrompt(p)}
                    onRegenerate={(id) => void handleRegenerate(id)}
                    onThumbsDown={handleThumbsDown}
                    onStop={handleStopGeneration}
                />

                <Composer
                    onSend={(text, attach) => void handleSendMessage(text, attach)}
                    onStop={handleStopGeneration}
                    isGenerating={isLoading}
                    activeModel={activeModel}
                    setActiveModel={setActiveModel}
                    initialPrompt={stagedPrompt}
                    onClearInitialPrompt={() => setStagedPrompt("")}
                />
            </main>

            {/* Negative Feedback Dialog */}
            <FeedbackDialog
                isOpen={feedbackModal.isOpen}
                onClose={() => setFeedbackModal({ isOpen: false, messageId: "" })}
                sessionId={sessionId}
                messageId={feedbackModal.messageId}
                user={user.username || "user"}
                model={activeModel}
            />

            {/* Settings Dialog */}
            <SettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                defaultModel={activeModel}
                onDefaultModelChange={setActiveModel}
            />

            {/* Help & Support Dialog */}
            {isHelpOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs"
                    role="presentation"
                    onClick={() => setIsHelpOpen(false)}
                >
                    <section
                        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="help-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="help-title" className="text-lg font-bold text-stone-900 dark:text-stone-100">
                            J-CHAT Enterprise Help
                        </h2>
                        <div className="mt-3 space-y-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                            <p>
                                <strong>Screenshot &amp; Image Analysis:</strong> Press <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">⌘V</kbd> or <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">Ctrl+V</kbd> anywhere or drag and drop screenshots directly into the composer.
                            </p>
                            <p>
                                <strong>Code Blocks &amp; Tables:</strong> AI responses automatically render structured markdown with language badges and instant one-click code copy.
                            </p>
                            <p>
                                <strong>Shortcuts:</strong> Press <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">⌘K</kbd> to search conversation history, <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">⌘⇧O</kbd> for a new chat, and <kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">Esc</kbd> to stop generation.
                            </p>
                        </div>
                        <Button
                            type="button"
                            className="mt-6 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
                            onClick={() => setIsHelpOpen(false)}
                        >
                            Got it
                        </Button>
                    </section>
                </div>
            )}
        </div>
    )
}
