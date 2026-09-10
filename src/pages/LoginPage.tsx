"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { login } from "@/api/auth"
import janaticsLogo from "@/assets/logo.png"

interface LoginPageProps {
    onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError("")
        setIsSubmitting(true)
        try {
            await login(username, password)
            onLogin()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to sign in. Please verify your credentials.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleFillDemo = () => {
        setUsername("muniyappan")
        setPassword("password123")
        setError("")
    }

    return (
        <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#f4f7fb] p-4 text-stone-900 selection:bg-blue-100 antialiased dark:bg-[#090b10] dark:text-stone-100 dark:selection:bg-blue-900">
            {/* Crisp Ambient Background Gradients */}
            <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-gradient-to-b from-blue-500/15 to-transparent blur-3xl dark:from-blue-600/20" />
            <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-gradient-to-t from-indigo-500/10 to-transparent blur-3xl dark:from-indigo-600/15" />

            {/* Subtle Engineering Grid Backdrop */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                style={{
                    backgroundImage: "radial-gradient(#0052AD 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />

            {/* Card Container */}
            <div className="relative w-full max-w-[460px]">
                {/* Header Branding Pill */}
                <div className="mb-6 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <img
                            src={janaticsLogo}
                            alt="JANATICS"
                            className="h-6 w-auto object-contain brightness-95"
                        />
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-[11px] font-semibold text-[#0052AD] backdrop-blur-xs dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
                        <Sparkles className="size-3 text-[#0052AD] dark:text-blue-400" />
                        J-CHAT Enterprise
                    </span>
                </div>

                {/* Login Glassmorphic Card */}
                <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-8 shadow-[0_20px_50px_rgba(0,82,173,0.08)] backdrop-blur-xl transition-all sm:p-10 dark:border-stone-800/90 dark:bg-stone-900/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
                            Sign in to your account
                        </h1>
                        <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                            Use your internal Janatics <strong>ITRS</strong> username &amp; password to access the AI workspace.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                                Username or Email
                            </label>
                            <div className="relative flex items-center">
                                <User className="pointer-events-none absolute left-3.5 size-4 text-stone-400 dark:text-stone-500" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="e.g. muniyappan or user@janatics.com"
                                    autoComplete="username"
                                    required
                                    className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50/60 pr-4 pl-10 text-sm font-medium text-stone-900 placeholder:text-stone-400 transition-all focus:border-[#0052AD] focus:bg-white focus:ring-4 focus:ring-[#0052AD]/10 focus:outline-none dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-blue-500 dark:focus:bg-stone-800"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => alert("Please contact ITRS Helpdesk (ext 4040) to reset your internal credentials.")}
                                    className="text-xs font-medium text-[#0052AD] hover:underline dark:text-blue-400"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative flex items-center">
                                <Lock className="pointer-events-none absolute left-3.5 size-4 text-stone-400 dark:text-stone-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your ITRS password"
                                    autoComplete="current-password"
                                    required
                                    className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50/60 pr-10 pl-10 text-sm font-medium text-stone-900 placeholder:text-stone-400 transition-all focus:border-[#0052AD] focus:bg-white focus:ring-4 focus:ring-[#0052AD]/10 focus:outline-none dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-blue-500 dark:focus:bg-stone-800"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 rounded-lg p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Device Option */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="size-4 rounded border-stone-300 accent-[#0052AD] focus:ring-[#0052AD]"
                                />
                                <span>Remember this terminal</span>
                            </label>

                            {/* Demo Autofill chip for development */}
                            <button
                                type="button"
                                onClick={handleFillDemo}
                                className="rounded-lg bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                                title="Quick fill demo credentials"
                            >
                                Fill Demo
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div
                                className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0052AD] text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-[#00428c] active:scale-[0.99] disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center gap-2">
                                    <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span>Authenticating...</span>
                                </div>
                            ) : (
                                <>
                                    <span>Sign in to J-CHAT</span>
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Security Footer Note */}
                    <div className="mt-8 flex items-center justify-center gap-2 border-t border-stone-100 pt-5 text-center text-[11px] text-stone-500 dark:border-stone-800 dark:text-stone-400">
                        <ShieldCheck className="size-4 text-[#0052AD] dark:text-blue-400 shrink-0" />
                        <span>Protected by Janatics Information Security &amp; AUP Policy</span>
                    </div>
                </div>

                {/* Bottom IT Help text */}
                <p className="mt-4 text-center text-xs text-stone-500 dark:text-stone-400">
                    Need an account? Contact your department supervisor or IT Support.
                </p>
            </div>
        </main>
    )
}
