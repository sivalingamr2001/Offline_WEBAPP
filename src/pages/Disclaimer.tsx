import janaticsLogo from "@/assets/logo.png"
import { useState } from "react"

import { Button } from "@/components/ui/button"

interface DisclaimerPageProps {
    onAccept: () => void
}

export default function DisclaimerPage({ onAccept }: DisclaimerPageProps) {
    const [isAcknowledged, setIsAcknowledged] = useState(false)
    return (
        <main className="min-h-svh bg-[#eef5fb] text-[#294765]">
            <section className="mx-auto min-h-svh w-full bg-white shadow-xl">
                <header className="flex items-center gap-5 bg-gradient-to-r from-[#0756a8] to-[#1d6fc0] px-6 py-5 text-white sm:px-10">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-white p-2">
                        <img src={janaticsLogo} alt="JANATICS" className="w-full" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold sm:text-2xl">JChat - Acceptable Use Policy</h1>
                        <p className="mt-1 text-sm text-blue-100 sm:text-base">Please read these simple rules before using JChat.</p>
                    </div>
                </header>
                <div className="p-5 sm:p-6 lg:p-8">
                    <div className="rounded-lg border-l-4 border-[#1768b8] bg-[#f3f8fd] px-4 py-3 text-sm sm:text-base">
                        JChat is for approved business use. Protect company information, use AI responsibly, and always verify AI-generated responses.
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1.7fr_1fr]">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                "Use JChat only for approved business purposes.",
                                "Do not enter passwords, confidential, personal, or sensitive company information.",
                                "Do not create illegal, offensive, harmful, or inappropriate content.",
                                "Follow the company's Information Security Policy while using JChat.",
                                "Do not use JChat for public web searches or protected information unless approved.",
                                "Always review and verify AI-generated answers before using or sharing them.",
                                "JChat usage may be logged and monitored for security and compliance.",
                                "High-risk or external-facing content must be reviewed by Legal, HR, or Compliance when required.",
                                "Report misuse or accidental data exposure immediately.",
                            ].map((rule, index) => (
                                <div key={rule} className="flex gap-2 rounded-lg border border-[#d8e5f1] p-3 text-sm leading-5">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eaf3fc] text-sm font-bold text-[#1768b8]">{index + 1}</span>
                                    <span>{rule}</span>
                                </div>
                            ))}
                        </div>
                        <aside>
                            <h2 className="text-xl font-bold text-[#174d7c]">AI Services Used by JChat</h2>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                <div className="rounded-lg border border-[#d8e5f1] p-3"><strong>OpenAI</strong><p className="mt-1 text-sm text-[#71869b]">Approved OpenAI models may be used.</p></div>
                                <div className="rounded-lg border border-[#d8e5f1] p-3"><strong>Google Gemini</strong><p className="mt-1 text-sm text-[#71869b]">Approved Gemini models may be used.</p></div>
                            </div>
                            <div className="mt-3 rounded-lg border border-[#f0d7a8] bg-[#fff6e8] p-4 text-sm leading-5"><strong>Why can AI answers differ?</strong><p className="mt-1">Different AI models or versions may respond differently because they are trained, updated, and configured differently.</p><strong className="mt-3 block">AI answers are for assistance only - always verify before business use.</strong></div>
                        </aside>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 border-t border-[#d8e5f1] pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-start gap-3 text-sm sm:text-base"><input type="checkbox" checked={isAcknowledged} onChange={(event) => setIsAcknowledged(event.target.checked)} className="mt-1 size-5 accent-[#1768b8]" /><span>I acknowledge that I have read, understood, and agree to comply with the JChat Acceptable Usage Policy.</span></label>
                        <Button type="button" disabled={!isAcknowledged} className="shrink-0 bg-[#abc2da] px-7 font-bold text-white hover:bg-[#1768b8] disabled:cursor-not-allowed disabled:opacity-70" onClick={onAccept}>Accept &amp; Continue</Button>
                    </div>
                </div>
            </section>
        </main>
    )
}
