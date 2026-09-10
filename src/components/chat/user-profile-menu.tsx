"use client"

import { useState, useRef, useEffect } from "react"
import { HelpCircle, LogOut, Moon, Settings, Sun, User, MoreVertical } from "lucide-react"
import type { AuthUser } from "@/api/auth"
import { useTheme } from "@/components/theme-provider"

interface UserProfileMenuProps {
    user: AuthUser
    onOpenSettings: () => void
    onOpenHelp: () => void
    onLogout: () => void
}

export function UserProfileMenu({
    user,
    onOpenSettings,
    onOpenHelp,
    onLogout,
}: UserProfileMenuProps) {
    const { theme, setTheme } = useTheme()
    const [isOpen, setIsOpen] = useState(false)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const displayName = user.name || user.username || "Muniyappan"
    const displayEmail = user.email || `${user.username || "user"}@janatics.com`
    const initials =
        displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "M"

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    return (
        <div ref={menuRef} className="relative w-full">
            {/* User Card Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/15 focus:outline-none"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-xs font-bold text-white shadow-xs">
                    {initials}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white group-hover:text-blue-100">
                        {displayName}
                    </p>
                    <p className="truncate text-[11px] text-white/70">
                        {displayEmail}
                    </p>
                </div>
                <MoreVertical className="size-4 shrink-0 text-white/60 group-hover:text-white" />
            </button>

            {/* Profile Dropdown Menu */}
            {isOpen && (
                <div
                    className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-stone-800 dark:bg-stone-900"
                    role="menu"
                >
                    {/* User Header */}
                    <div className="p-2 border-b border-stone-100 dark:border-stone-800">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-[#0052AD] text-sm font-bold text-white shadow-xs">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                                    {displayName}
                                </p>
                                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                                    {displayEmail}
                                </p>
                                <span className="mt-1 inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                    {user.department || "ITRS Department"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Menu Actions */}
                    <div className="mt-1 space-y-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                setIsProfileModalOpen(true)
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                            role="menuitem"
                        >
                            <User className="size-4 text-stone-500" />
                            <span>Profile Details</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                onOpenSettings()
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                            role="menuitem"
                        >
                            <Settings className="size-4 text-stone-500" />
                            <span>Settings</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setTheme(theme === "dark" ? "light" : "dark")
                                setIsOpen(false)
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                            role="menuitem"
                        >
                            {theme === "dark" ? (
                                <>
                                    <Sun className="size-4 text-amber-500" />
                                    <span>Switch to Light Mode</span>
                                </>
                            ) : (
                                <>
                                    <Moon className="size-4 text-indigo-400" />
                                    <span>Switch to Dark Mode</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                onOpenHelp()
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                            role="menuitem"
                        >
                            <HelpCircle className="size-4 text-stone-500" />
                            <span>Help &amp; Support</span>
                        </button>

                        <div className="my-1 h-px bg-stone-100 dark:bg-stone-800" />

                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false)
                                onLogout()
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                            role="menuitem"
                        >
                            <LogOut className="size-4" />
                            <span>Sign out</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {isProfileModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-xs"
                    role="presentation"
                    onClick={() => setIsProfileModalOpen(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center">
                            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#0052AD] text-xl font-bold text-white shadow-md">
                                {initials}
                            </div>
                            <h3 className="mt-3 text-lg font-bold text-stone-900 dark:text-stone-100">
                                {displayName}
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                {displayEmail}
                            </p>
                        </div>

                        <div className="mt-5 space-y-2.5 rounded-xl border border-stone-100 bg-stone-50/70 p-3 text-xs dark:border-stone-800 dark:bg-stone-800/40">
                            <div className="flex justify-between">
                                <span className="text-stone-500">Employee ID:</span>
                                <span className="font-medium text-stone-800 dark:text-stone-200">
                                    {user.id}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-500">Department:</span>
                                <span className="font-medium text-stone-800 dark:text-stone-200">
                                    {user.department || "ITRS Department"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-500">AUP Policy Status:</span>
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                    Active &amp; Compliant
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsProfileModalOpen(false)}
                            className="mt-6 w-full rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
