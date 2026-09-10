import { HelpCircle, LogOut, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import jchatLogo from "@/assets/JchatLogo.png"

interface SidebarProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    sessions: Array<{ session_id: string; title: string }>
    activeSessionId: string
    onSelectSession: (sessionId: string) => void
    onHelp: () => void
    onLogout: () => void
    onNewChat: () => void
}

export function Sidebar({ isOpen, setIsOpen, sessions, activeSessionId, onSelectSession, onHelp, onLogout, onNewChat }: SidebarProps) {
    return (
        <aside className={`fixed inset-y-0 left-0 flex w-65 flex-col border-r border-stone-200 bg-[#0052AD] p-5 shadow-xl transition-transform md:relative md:translate-x-0 md:shadow-none ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="flex items-center justify-between">
                <img src={jchatLogo} alt="J-Chat" className="h-20 w-full object-contain object-left" />
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsOpen(false)} aria-label="Close sidebar"><X /></Button>
            </div>
            <div className="mt-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Conversations</h2>
                <Button variant="ghost" size="icon" className="size-8 text-white hover:bg-white/10 hover:text-white" onClick={onNewChat} aria-label="Start new chat" title="Start new chat"><Plus className="size-5" /></Button>
            </div>
            <div className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {sessions.length === 0 ? <p className="text-sm text-stone-400">Your recent conversations will appear here.</p> : sessions.map((conversation) => (
                    <button key={conversation.session_id} type="button" onClick={() => { onSelectSession(conversation.session_id); setIsOpen(false) }} className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${activeSessionId === conversation.session_id ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/10"}`} title={conversation.title}>
                        {conversation.title || "New conversation"}
                    </button>
                ))}
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-white/15 pt-4">
                <Button variant="ghost" className="w-full justify-start text-white hover:bg-white/10 hover:text-white" onClick={onHelp}>
                    <HelpCircle /> Help
                </Button>
                <Button variant="ghost" className="w-full justify-start text-white hover:bg-white/10 hover:text-white" onClick={onLogout}>
                    <LogOut /> Logout
                </Button>
            </div>
        </aside>
    )
}
