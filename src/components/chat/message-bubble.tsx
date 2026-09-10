"use client"
import type { Message } from "@/types/chat"
import { AnimatedOrb } from "./animated-orb"
import { User } from "lucide-react"
export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === "user"

  return (
    <div
      className={`flex w-full items-start gap-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="-mt-2 -mr-20 origin-top-left scale-[0.25]">
          <AnimatedOrb />
        </div>
      )}
      <div
        className={`flex max-w-[80%] flex-col ${isUser ? "items-end" : "items-start"}`}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-500">
            {isUser ? "You" : "Assistant"}
          </span>
          <span className="text-[10px] text-stone-400">
            {message.timestamp}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isUser ? "rounded-tr-none bg-stone-900 text-white" : "rounded-tl-none border border-stone-100 bg-white text-stone-800"}`}
        >
          <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-stone-600 shadow-inner">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
