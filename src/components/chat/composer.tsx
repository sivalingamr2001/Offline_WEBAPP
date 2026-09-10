"use client"
import { useState, useRef } from "react"
import { SendHorizontal, Mic, Paperclip, Brain, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
interface ComposerProps {
  onSend: (text: string) => void
  onAttach: (file: File) => void
  activeModel: string
  setActiveModel: (model: string) => void
}
export function Composer({
  onSend,
  onAttach,
  activeModel,
  setActiveModel,
}: ComposerProps) {
  const [input, setInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input)
    setInput("")
  }

  const handleVoiceToggle = () => {
    setIsListening(!isListening)
    toast({
      title: !isListening ? "Voice Mode Activated" : "Voice Mode Paused",
      description: !isListening
        ? "Listening to audio..."
        : "Audio processing offline.",
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onAttach(e.target.files[0])
      toast({
        title: "File Attached Successfully",
        description: `Selected: ${e.target.files[0].name}`,
      })
    }
  }

  return (
    <div className="fixed right-0 bottom-4 left-0 z-10 px-4 md:left-72">
      <div className="relative mx-auto max-w-2xl rounded-3xl border border-stone-200/40 bg-white p-4 shadow-xl">
        <div className="flex items-center gap-2 rounded-2xl border border-stone-100 bg-stone-50/50 p-2 transition-colors focus-within:border-stone-200/80">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              !e.shiftKey &&
              (e.preventDefault(), handleSend())
            }
            placeholder={
              isListening
                ? "Listening..."
                : "Type a message... (Shift+Enter for new line)"
            }
            rows={1}
            className="max-h-[56px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
          />
          <Button
            size="icon"
            variant="ghost"
            disabled={!input.trim()}
            onClick={handleSend}
            className="h-9 w-9 rounded-full text-stone-500 hover:text-stone-800 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.txt"
          />
          <Button
            size="icon"
            variant="secondary"
            onClick={handleVoiceToggle}
            className={`h-9 w-9 rounded-full ${isListening ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
          >
            {isListening ? (
              <MicOff className="h-4 w-4 animate-bounce" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
              >
                <Brain className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-40 rounded-xl border border-stone-100 bg-white shadow-lg"
            >
              {["Gemini", "GPT-4o", "Claude 3.5"].map((m) => (
                <DropdownMenuItem
                  key={m}
                  onClick={() => setActiveModel(m)}
                  className="cursor-pointer text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  {m}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs font-semibold text-stone-400 select-none">
            {activeModel}
          </span>
        </div>
      </div>
    </div>
  )
}
