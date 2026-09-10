"use client"

import { useState } from "react"
import { Keyboard, Moon, Settings, Sun, Monitor, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { toast } from "sonner"

interface SettingsDialogProps {
    isOpen: boolean
    onClose: () => void
    defaultModel: string
    onDefaultModelChange: (model: string) => void
}

const SHORTCUTS = [
    { keys: "⌘ / Ctrl + K", desc: "Search conversations" },
    { keys: "⌘ / Ctrl + Shift + O", desc: "Start new chat" },
    { keys: "⌘ / Ctrl + /", desc: "Focus message composer" },
    { keys: "⌘ / Ctrl + V", desc: "Paste screenshot image" },
    { keys: "Esc", desc: "Stop response / close dialogs" },
    { keys: "Enter", desc: "Send message" },
    { keys: "Shift + Enter", desc: "New line in composer" },
]

export function SettingsDialog({
    isOpen,
    onClose,
    defaultModel,
    onDefaultModelChange,
}: SettingsDialogProps) {
    const { theme, setTheme } = useTheme()
    const [activeTab, setActiveTab] = useState<"general" | "shortcuts">("general")
    const [systemPrompt, setSystemPrompt] = useState(
        "You are J-CHAT, an enterprise engineering assistant at Janatics Pneumatic."
    )

    if (!isOpen) return null

    const handleSave = () => {
        toast.success("Preferences updated successfully")
        onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 pb-4 dark:border-stone-800">
                    <div className="flex items-center gap-2">
                        <Settings className="size-5 text-stone-700 dark:text-stone-300" />
                        <h3 id="settings-title" className="text-base font-semibold text-stone-900 dark:text-stone-100">
                            J-CHAT Settings
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="mt-4 flex gap-2 border-b border-stone-100 pb-2 dark:border-stone-800">
                    <button
                        type="button"
                        onClick={() => setActiveTab("general")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            activeTab === "general"
                                ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100"
                                : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                        }`}
                    >
                        General & Appearance
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("shortcuts")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            activeTab === "shortcuts"
                                ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100"
                                : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                        }`}
                    >
                        <Keyboard className="size-3.5" />
                        Keyboard Shortcuts
                    </button>
                </div>

                {activeTab === "general" ? (
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                                Default AI Model
                            </label>
                            <select
                                value={defaultModel}
                                onChange={(e) => onDefaultModelChange(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-blue-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                            >
                                <option value="Gemini">Google Gemini (Default)</option>
                                <option value="GPT-4o">OpenAI GPT-4o</option>
                                <option value="Claude 3.5">Anthropic Claude 3.5</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                                Appearance Theme
                            </label>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTheme("light")}
                                    className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium ${
                                        theme === "light"
                                            ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                                            : "border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
                                    }`}
                                >
                                    <Sun className="size-4 text-amber-500" />
                                    Light
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme("dark")}
                                    className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium ${
                                        theme === "dark"
                                            ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                                            : "border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
                                    }`}
                                >
                                    <Moon className="size-4 text-indigo-400" />
                                    Dark
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme("system")}
                                    className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium ${
                                        theme === "system"
                                            ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
                                            : "border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
                                    }`}
                                >
                                    <Monitor className="size-4 text-stone-400" />
                                    System
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                                System Context / Instructions
                            </label>
                            <textarea
                                rows={3}
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 text-xs text-stone-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {SHORTCUTS.map((sc) => (
                            <div
                                key={sc.keys}
                                className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-800/40"
                            >
                                <span className="text-stone-700 dark:text-stone-300">{sc.desc}</span>
                                <kbd className="rounded-md border border-stone-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-600 shadow-2xs dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                                    {sc.keys}
                                </kbd>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    )
}
