"use client"

import { useState, useMemo, useRef } from "react"
import {
    Check,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    MessageSquare,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserProfileMenu } from "./user-profile-menu"
import type { AuthUser } from "@/api/auth"

export interface SidebarSession {
    session_id: string
    title: string
    updated_at?: string
}

interface SidebarProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    sessions: SidebarSession[]
    activeSessionId: string
    onSelectSession: (sessionId: string) => void
    onHelp: () => void
    onLogout: () => void
    onNewChat: () => void
    onRenameSession: (sessionId: string, newTitle: string) => void
    onDeleteSession: (sessionId: string) => void
    onOpenSettings: () => void
    user: AuthUser
    searchQuery: string
    onSearchChange: (query: string) => void
    isCollapsed?: boolean
    onToggleCollapse?: () => void
}

function groupSessions(sessions: SidebarSession[], searchQuery: string) {
    const filtered = sessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
    const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000

    const groups: Record<string, SidebarSession[]> = {
        Today: [],
        Yesterday: [],
        "Previous 7 Days": [],
        Older: [],
    }

    filtered.forEach((session, idx) => {
        const time = session.updated_at ? new Date(session.updated_at).getTime() : startOfToday - idx * 1000 * 60 * 60 * 12
        if (time >= startOfToday) {
            groups.Today.push(session)
        } else if (time >= startOfYesterday) {
            groups.Yesterday.push(session)
        } else if (time >= startOf7DaysAgo) {
            groups["Previous 7 Days"].push(session)
        } else {
            groups.Older.push(session)
        }
    })

    return groups
}

export function Sidebar({
    isOpen,
    setIsOpen,
    sessions,
    activeSessionId,
    onSelectSession,
    onHelp,
    onLogout,
    onNewChat,
    onRenameSession,
    onDeleteSession,
    onOpenSettings,
    user,
    searchQuery,
    onSearchChange,
    isCollapsed = false,
    onToggleCollapse,
}: SidebarProps) {
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const searchInputRef = useRef<HTMLInputElement>(null)

    const grouped = useMemo(
        () => groupSessions(sessions, searchQuery),
        [sessions, searchQuery]
    )

    const handleStartRename = (sessionId: string, currentTitle: string) => {
        setEditingSessionId(sessionId)
        setEditTitle(currentTitle)
    }

    const handleSaveRename = (sessionId: string) => {
        if (editTitle.trim()) {
            onRenameSession(sessionId, editTitle.trim())
        }
        setEditingSessionId(null)
    }

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#00428c] bg-[#0052AD] text-white shadow-2xl transition-all duration-300 md:relative ${
                    isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                } ${isCollapsed ? "md:w-18" : "w-72"}`}
            >
                {/* Header: Clean J-CHAT title without enterprise badge and without icon */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/15 px-5">
                    {!isCollapsed ? (
                        <h1 className="text-xl font-bold tracking-tight text-white">
                            J-CHAT
                        </h1>
                    ) : (
                        <span className="mx-auto text-lg font-bold text-white">J</span>
                    )}

                    {/* Mobile close button & Desktop collapse toggle */}
                    <div className="flex items-center gap-1">
                        {onToggleCollapse && (
                            <button
                                type="button"
                                onClick={onToggleCollapse}
                                className="hidden rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white md:block"
                                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            >
                                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                            </button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-white/70 hover:bg-white/10 hover:text-white md:hidden"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close sidebar"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                </div>

                {/* New Chat Button */}
                <div className="p-3">
                    <button
                        type="button"
                        onClick={() => {
                            onNewChat()
                            setIsOpen(false)
                        }}
                        className={`group flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/15 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-white/25 hover:border-white/30 ${
                            isCollapsed ? "px-0" : "px-4"
                        }`}
                        title="New chat (⌘+Shift+O)"
                    >
                        <Plus className="size-4 text-white group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span>New chat</span>}
                    </button>
                </div>

                {/* Conversation Search Bar */}
                {!isCollapsed && (
                    <div className="px-3 pb-2">
                        <div className="relative flex items-center">
                            <Search className="pointer-events-none absolute left-3 size-3.5 text-white/60" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder="Search conversations (⌘K)..."
                                className="w-full rounded-xl border border-white/20 bg-white/10 py-1.5 pr-8 pl-8 text-xs text-white placeholder:text-white/60 focus:border-white/40 focus:bg-white/20 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => onSearchChange("")}
                                    className="absolute right-2.5 rounded-full p-0.5 text-white/60 hover:text-white"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Conversation Groups List */}
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 scrollbar-thin scrollbar-thumb-white/20">
                    {!isCollapsed ? (
                        Object.entries(grouped).every(([, list]) => list.length === 0) ? (
                            <div className="p-4 text-center text-xs text-white/60">
                                {searchQuery ? "No matching conversations found." : "No conversations yet."}
                            </div>
                        ) : (
                            Object.entries(grouped).map(([groupTitle, list]) => {
                                if (list.length === 0) return null
                                return (
                                    <div key={groupTitle} className="mb-4">
                                        <h3 className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-white/65 uppercase">
                                            {groupTitle}
                                        </h3>
                                        <div className="space-y-0.5">
                                            {list.map((session) => {
                                                const isActive = activeSessionId === session.session_id
                                                const isEditing = editingSessionId === session.session_id

                                                if (isEditing) {
                                                    return (
                                                        <div
                                                            key={session.session_id}
                                                            className="flex items-center gap-1 rounded-xl bg-white/20 px-2 py-1"
                                                        >
                                                            <input
                                                                type="text"
                                                                value={editTitle}
                                                                onChange={(e) => setEditTitle(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") handleSaveRename(session.session_id)
                                                                    if (e.key === "Escape") setEditingSessionId(null)
                                                                }}
                                                                className="w-full bg-transparent text-xs text-white outline-none"
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveRename(session.session_id)}
                                                                className="rounded p-1 text-emerald-300 hover:text-emerald-200"
                                                            >
                                                                <Check className="size-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingSessionId(null)}
                                                                className="rounded p-1 text-white/70 hover:text-white"
                                                            >
                                                                <X className="size-3.5" />
                                                            </button>
                                                        </div>
                                                    )
                                                }

                                                return (
                                                    <div
                                                        key={session.session_id}
                                                        className={`group relative flex items-center rounded-xl px-2.5 py-2 transition-colors ${
                                                            isActive
                                                                ? "bg-white/25 text-white font-semibold shadow-xs"
                                                                : "text-white/80 hover:bg-white/15 hover:text-white"
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                onSelectSession(session.session_id)
                                                                setIsOpen(false)
                                                            }}
                                                            className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
                                                            title={session.title}
                                                        >
                                                            <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                                                            <span className="truncate">{session.title}</span>
                                                        </button>

                                                        {/* Actions Menu */}
                                                        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button
                                                                        type="button"
                                                                        className="rounded p-1 text-white/70 hover:bg-white/20 hover:text-white"
                                                                        title="Conversation options"
                                                                    >
                                                                        <MoreHorizontal className="size-3.5" />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent
                                                                    align="end"
                                                                    className="w-36 rounded-xl border border-stone-200 bg-white p-1 text-stone-700 shadow-xl dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200"
                                                                >
                                                                    <DropdownMenuItem
                                                                        onClick={() =>
                                                                            handleStartRename(session.session_id, session.title)
                                                                        }
                                                                        className="cursor-pointer gap-2 rounded-lg text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
                                                                    >
                                                                        <Pencil className="size-3.5" />
                                                                        <span>Rename</span>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => onDeleteSession(session.session_id)}
                                                                        className="cursor-pointer gap-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                        <span>Delete</span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })
                        )
                    ) : (
                        <div className="flex flex-col items-center space-y-2 py-2">
                            {sessions.slice(0, 8).map((session) => (
                                <button
                                    key={session.session_id}
                                    type="button"
                                    onClick={() => onSelectSession(session.session_id)}
                                    className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                                        activeSessionId === session.session_id
                                            ? "bg-white/30 text-white shadow-xs"
                                            : "text-white/70 hover:bg-white/15 hover:text-white"
                                    }`}
                                    title={session.title}
                                >
                                    <MessageSquare className="size-4" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with Help trigger and User Profile Menu */}
                <div className="shrink-0 border-t border-white/15 p-2.5">
                    {!isCollapsed ? (
                        <div className="space-y-1">
                            <Button
                                variant="ghost"
                                onClick={onHelp}
                                className="w-full justify-start gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/15 hover:text-white"
                            >
                                <HelpCircle className="size-4 text-white/70" />
                                <span>Help &amp; Support</span>
                            </Button>

                            <UserProfileMenu
                                user={user}
                                onOpenSettings={onOpenSettings}
                                onOpenHelp={onHelp}
                                onLogout={onLogout}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 py-1">
                            <button
                                type="button"
                                onClick={onHelp}
                                className="flex size-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/15 hover:text-white"
                                title="Help & Support"
                            >
                                <HelpCircle className="size-4" />
                            </button>
                            <UserProfileMenu
                                user={user}
                                onOpenSettings={onOpenSettings}
                                onOpenHelp={onHelp}
                                onLogout={onLogout}
                            />
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}
