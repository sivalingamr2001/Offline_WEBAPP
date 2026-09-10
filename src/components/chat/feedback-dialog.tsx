"use client"

import { useState } from "react"
import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { submitFeedback, type FeedbackPayload } from "@/api/feedback"
import { toast } from "sonner"

interface FeedbackDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    messageId: string
    user: string
    model: string
    onFeedbackSubmitted?: () => void
}

const FEEDBACK_OPTIONS: Array<FeedbackPayload["feedbackType"]> = [
    "Incorrect answer",
    "Not relevant",
    "Poor response",
    "Missing information",
    "Other",
]

export function FeedbackDialog({
    isOpen,
    onClose,
    sessionId,
    messageId,
    user,
    model,
    onFeedbackSubmitted,
}: FeedbackDialogProps) {
    const [selectedType, setSelectedType] = useState<FeedbackPayload["feedbackType"]>("Incorrect answer")
    const [comment, setComment] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            await submitFeedback({
                user,
                sessionId,
                messageId,
                feedbackType: selectedType,
                comment: comment.trim(),
                model,
                timestamp: new Date().toISOString(),
            })
            toast.success("Thank you for your feedback! It helps improve J-CHAT.")
            onFeedbackSubmitted?.()
            onClose()
        } catch {
            toast.error("Unable to send feedback at this time.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs transition-opacity"
            role="presentation"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl transition-transform dark:border-stone-800 dark:bg-stone-900"
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="size-5 text-amber-500" />
                        <h3 id="feedback-title" className="text-base font-semibold text-stone-900 dark:text-stone-100">
                            Tell us what went wrong
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

                <div className="mt-4 space-y-2.5">
                    {FEEDBACK_OPTIONS.map((option) => (
                        <label
                            key={option}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-sm transition-all ${
                                selectedType === option
                                    ? "border-blue-500 bg-blue-50/60 font-medium text-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
                                    : "border-stone-200 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800/60"
                            }`}
                        >
                            <input
                                type="radio"
                                name="feedback-type"
                                value={option}
                                checked={selectedType === option}
                                onChange={() => setSelectedType(option)}
                                className="size-4 text-blue-600 accent-blue-600 focus:ring-blue-500"
                            />
                            <span>{option}</span>
                        </label>
                    ))}
                </div>

                <div className="mt-4">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Additional feedback
                    </label>
                    <textarea
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Tell us more about how the answer could be improved..."
                        className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-stone-800 dark:bg-stone-800 dark:text-stone-200"
                    />
                </div>

                <div className="mt-6 flex items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-xl text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="rounded-xl bg-blue-600 px-5 font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        {isSubmitting ? "Submitting..." : "Submit Feedback"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
