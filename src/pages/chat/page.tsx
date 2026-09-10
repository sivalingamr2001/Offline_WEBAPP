"use client"
import { useState } from "react"
import { streamChat } from "@/api/chat"
import { uploadFile, type Attachment } from "@/api/attachments"
import { getHistory, saveSearch, startSession } from "@/api/sessions"
import { useEffect } from "react"
import janaticsLogo from "@/assets/logo.png"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { Composer } from "@/components/chat/composer"
import type { Message } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { logout } from "@/api/auth"
interface ChatPageProps {
  onLogout: () => void
}

export default function JarvisChatPage({ onLogout }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeModel, setActiveModel] = useState("Gemini")
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<Array<{ session_id: string; title: string }>>([])
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const toMessages = (selectedSessionId: string, history: Array<Message | { role: string; content: string }>) =>
    history.flatMap((item, index) => {
      if ("role" in item && (item.role === "user" || item.role === "assistant")) {
        return [{ id: `${selectedSessionId}-${index}`, sender: item.role as Message["sender"], text: item.content, timestamp: "" }]
      }
      return []
    })

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const { histroy } = await getHistory()
        setSessions(histroy.map(({ session_id, title }) => ({ session_id, title })))
        if (histroy.length > 0) {
          const latest = histroy[histroy.length - 1]
          setSessionId(latest.session_id)
          setMessages(toMessages(latest.session_id, latest.messages))
          return
        }
      } catch {
        // Create a usable local session when history is unavailable.
      }
      try {
        const { session_id } = await startSession()
        setSessionId(session_id)
      } catch {
        // The generated fallback ID still allows the chat request to proceed.
      }
    }
    void loadSessions()
  }, [])

  const handleNewChat = async () => {
    try {
      const { session_id } = await startSession()
      setSessionId(session_id)
      setMessages([])
      setAttachment(null)
      setIsSidebarOpen(false)
    } catch (cause) {
      setSessionId(crypto.randomUUID())
      setMessages([])
      setAttachment(null)
      if (cause instanceof Error) console.error(cause.message)
    }
  }

  const handleSendMessage = async (text: string) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text,
      timestamp,
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    const assistantId = `${Date.now()}-assistant`
    setMessages((prev) => [...prev, { id: assistantId, sender: "assistant", text: "", timestamp }])
    try {
      const model = activeModel === "GPT-4o" ? "gpt-4o" : "gpt-4.1-mini"
      let assistantText = ""
      await streamChat(text, sessionId, model, attachment, (event) => {
        if (event.type === "token" && event.content) {
          assistantText += event.content
          setMessages((prev) => prev.map((message) => message.id === assistantId ? { ...message, text: message.text + event.content } : message))
        }
        if (event.type === "error") throw new Error(event.message || "Chat request failed")
      })
      void saveSearch(text, assistantText, sessionId, attachment?.file_url).catch(() => undefined)
      setSessions((prev) => prev.some((item) => item.session_id === sessionId) ? prev : [...prev, { session_id: sessionId, title: text }])
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Chat request failed"
      setMessages((prev) => prev.map((item) => item.id === assistantId ? { ...item, text: message } : item))
    } finally {
      setIsLoading(false)
      setAttachment(null)
    }
  }

  const handleAttach = async (file: File) => {
    try {
      setAttachment(await uploadFile(file))
    } catch (cause) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-error`, sender: "assistant", text: cause instanceof Error ? cause.message : "File upload failed", timestamp: new Date().toLocaleTimeString() }])
    }
  }

  const handleSelectSession = async (selectedSessionId: string) => {
    try {
      const { histroy } = await getHistory()
      const selected = histroy.find((item) => item.session_id === selectedSessionId)
      if (!selected) return
      setSessionId(selectedSessionId)
      setMessages(toMessages(selectedSessionId, selected.messages))
    } catch {
      // Keep the current conversation visible when history is unavailable.
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      onLogout()
    }
  }

  return (
    <div className="relative flex h-dvh w-screen overflow-hidden bg-stone-50 antialiased selection:bg-stone-200">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} sessions={sessions} activeSessionId={sessionId} onSelectSession={handleSelectSession} onHelp={() => setIsHelpOpen(true)} onLogout={() => void handleLogout()} onNewChat={() => void handleNewChat()} />

      <main className="relative flex h-full flex-1 flex-col overflow-hidden">
        <img src={janaticsLogo} alt="JANATICS" className="absolute top-5 right-6 z-10 h-4 w-auto object-contain" />
        <ChatWindow messages={messages} isLoading={isLoading} onToggleSidebar={() => setIsSidebarOpen((open) => !open)} />
        <Composer
          onSend={handleSendMessage}
          activeModel={activeModel}
          setActiveModel={setActiveModel}
          onAttach={handleAttach}
        />
      </main>
      {isHelpOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4" role="presentation" onClick={() => setIsHelpOpen(false)}>
          <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="help-title" className="text-lg font-semibold text-stone-800">Help</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">Ask questions in the message box. Use the paperclip to attach a supported file and the model menu to choose a chat model.</p>
            <Button type="button" className="mt-5 w-full" onClick={() => setIsHelpOpen(false)}>Close</Button>
          </section>
        </div>
      )}
    </div>
  )
}
