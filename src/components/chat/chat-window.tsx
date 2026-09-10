"use client"
import { MessageBubble } from "./message-bubble"
import { AnimatedOrb } from "./animated-orb"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Message } from "@/types/chat"
interface ChatWindowProps {
  messages: Message[]
  isLoading: boolean
  onToggleSidebar: () => void
}
export function ChatWindow({
  messages,
  isLoading,
  onToggleSidebar,
}: ChatWindowProps) {
  return (
    <div
      className="relative flex-1 overflow-y-auto px-4 pt-16 pb-40"
      role="log"
      aria-label="Chat logs"
    >
      <Button variant="ghost" size="icon" className="absolute top-4 left-4 z-20 rounded-full bg-white/80 shadow-sm md:hidden" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Menu className="h-5 w-5" />
      </Button>
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[60dvh] flex-col items-center justify-center text-center">
          <AnimatedOrb />
          <h1 className="text-lg font-medium text-stone-700">
            Hi, my name is Jarvis
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            Send a message to begin chatting with the AI assistant
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6 pt-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 px-2" role="status" aria-label="Assistant is thinking">
              <div className="flex flex-row gap-2">
                <div className="h-3 w-3 animate-bounce rounded-full bg-blue-700 [animation-delay:.7s]" />
                <div className="h-3 w-3 animate-bounce rounded-full bg-blue-700 [animation-delay:.3s]" />
                <div className="h-3 w-3 animate-bounce rounded-full bg-blue-700 [animation-delay:.7s]" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
