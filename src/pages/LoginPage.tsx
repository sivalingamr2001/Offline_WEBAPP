import { useState, type FormEvent } from "react"
import { LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { login } from "@/api/auth"

interface LoginPageProps {
    onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError("")
        setIsSubmitting(true)
        try {
            await login(username, password)
            onLogin()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to sign in")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className="flex min-h-svh items-center justify-center bg-[#c9eaf8]">
            <form onSubmit={handleSubmit} className="w-full max-w-[520px] rounded-[28px] border border-white/70 bg-white/95 px-8 py-7 shadow-[0_24px_60px_rgba(19,87,130,0.16)] sm:px-12 sm:py-8">
                <div className="mb-6 text-center">
                    {/* <img src={jchatLogo} alt="J-Chat" className="mx-auto h-20 w-full object-contain" /> */}
                    <h1 className="mt-2 text-3xl font-bold text-[#36a4e5] sm:text-4xl">Welcome to J-CHAT</h1>
                    <p className="mt-2 text-base font-semibold text-stone-700">(Janatics Chatbot)</p>
                    <p className="text-sm text-stone-500">Log in to your ITRS username &amp; password</p>
                </div>
                <label className="block text-base font-semibold text-stone-700">
                    Username or Email:
                    <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-blue-200 bg-white px-4 text-base font-normal text-stone-800 shadow-[0_0_0_3px_rgba(147,197,253,0.16)] outline-none focus:border-blue-400" autoComplete="username" required />
                </label>
                <label className="mt-4 block text-base font-semibold text-stone-700">
                    Password:
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-blue-50/70 px-4 text-base font-normal text-stone-800 outline-none focus:border-blue-400" autoComplete="current-password" required />
                </label>
                {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
                <Button type="submit" className="mt-5 h-11 w-full bg-gradient-to-r from-[#aeb9e8] via-[#8dbdf4] to-[#b9d5e5] text-lg font-bold text-stone-800 hover:from-[#9eabe1] hover:to-[#a8cbe0]" disabled={isSubmitting}>
                    <LogIn /> {isSubmitting ? "Signing in..." : "Login"}
                </Button>
                <div className="mt-4 space-y-2 text-center text-base font-semibold text-indigo-500">
                    <button type="button" className="block w-full hover:text-indigo-700">Forgot password?</button>
                    <button type="button" className="block w-full hover:text-indigo-700">Register</button>
                </div>
            </form>
        </main>
    )
}
