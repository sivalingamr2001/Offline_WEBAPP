"use client"

import { useState } from "react"
import { Check, Copy, Terminal } from "lucide-react"

interface MarkdownRendererProps {
    content: string
    isStreaming?: boolean
}

interface CodeBlockProps {
    language: string
    code: string
}

function CodeBlock({ language, code }: CodeBlockProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Fallback for clipboard
        }
    }

    const displayLanguage = language.trim() || "code"

    return (
        <div className="my-4 overflow-hidden rounded-xl border border-stone-800 bg-[#1e1e24] shadow-md">
            <div className="flex items-center justify-between border-b border-stone-800 bg-[#16161a] px-4 py-2 text-xs font-mono text-stone-400">
                <div className="flex items-center gap-2">
                    <Terminal className="size-3.5 text-blue-400" />
                    <span className="font-semibold uppercase tracking-wider text-stone-300">
                        {displayLanguage}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
                    title="Copy code to clipboard"
                >
                    {copied ? (
                        <>
                            <Check className="size-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="size-3.5" />
                            <span>Copy code</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-stone-200">
                <code>{code}</code>
            </pre>
        </div>
    )
}

function renderInline(text: string): React.ReactNode {
    // Splits by inline code: `code`
    const codeParts = text.split(/(`[^`]+`)/g)
    return codeParts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
            return (
                <code
                    key={i}
                    className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs font-medium text-blue-800 dark:bg-stone-800 dark:text-blue-300"
                >
                    {part.slice(1, -1)}
                </code>
            )
        }

        // Bold: **text**
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g)
        return boldParts.map((bPart, j) => {
            if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length >= 4) {
                return <strong key={`${i}-${j}`} className="font-semibold text-stone-900 dark:text-stone-100">{bPart.slice(2, -2)}</strong>
            }

            // Italic: *text* or _text_
            const italicParts = bPart.split(/(\*[^*]+\*|_[^_]+_)/g)
            return italicParts.map((itPart, k) => {
                if (
                    (itPart.startsWith("*") && itPart.endsWith("*") && itPart.length >= 2) ||
                    (itPart.startsWith("_") && itPart.endsWith("_") && itPart.length >= 2)
                ) {
                    return <em key={`${i}-${j}-${k}`} className="italic">{itPart.slice(1, -1)}</em>
                }
                return itPart
            })
        })
    })
}

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
    if (!content) {
        return isStreaming ? <span className="inline-block animate-pulse font-mono font-bold text-blue-500">▌</span> : null
    }

    // Split content into code blocks vs non-code markdown
    const blocks: Array<{ type: "code" | "text"; language?: string; content: string }> = []
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g

    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            blocks.push({
                type: "text",
                content: content.slice(lastIndex, match.index),
            })
        }
        blocks.push({
            type: "code",
            language: match[1] || "text",
            content: match[2] || "",
        })
        lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
        blocks.push({
            type: "text",
            content: content.slice(lastIndex),
        })
    }

    return (
        <div className="space-y-3 leading-relaxed text-stone-800 dark:text-stone-200">
            {blocks.map((block, index) => {
                if (block.type === "code") {
                    return (
                        <CodeBlock
                            key={index}
                            language={block.language || ""}
                            code={block.content.trimEnd()}
                        />
                    )
                }

                // Process regular markdown lines (headings, tables, lists, blockquotes, paragraphs)
                return (
                    <div key={index} className="space-y-2">
                        {renderMarkdownBlock(block.content)}
                    </div>
                )
            })}
            {isStreaming && (
                <span className="inline-block animate-pulse font-mono font-bold text-blue-500">
                    ▌
                </span>
            )}
        </div>
    )
}

function renderMarkdownBlock(text: string) {
    const lines = text.split("\n")
    const elements: React.ReactNode[] = []

    let inTable = false
    let tableRows: string[][] = []
    let listItems: { type: "ol" | "ul"; items: string[] } | null = null

    const flushList = () => {
        if (listItems) {
            if (listItems.type === "ul") {
                elements.push(
                    <ul key={`list-${elements.length}`} className="my-2 list-disc space-y-1 pl-6">
                        {listItems.items.map((item, idx) => (
                            <li key={idx} className="text-sm">{renderInline(item)}</li>
                        ))}
                    </ul>
                )
            } else {
                elements.push(
                    <ol key={`list-${elements.length}`} className="my-2 list-decimal space-y-1 pl-6">
                        {listItems.items.map((item, idx) => (
                            <li key={idx} className="text-sm">{renderInline(item)}</li>
                        ))}
                    </ol>
                )
            }
            listItems = null
        }
    }

    const flushTable = () => {
        if (inTable && tableRows.length > 0) {
            const headerRow = tableRows[0]
            const bodyRows = tableRows.slice(1).filter((r) => !r.every((c) => /^:?-+:?$/.test(c.trim())))

            elements.push(
                <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
                    <table className="min-w-full divide-y divide-stone-200 text-left text-sm dark:divide-stone-700">
                        <thead className="bg-stone-50 dark:bg-stone-800">
                            <tr>
                                {headerRow.map((col, colIdx) => (
                                    <th key={colIdx} className="px-3 py-2 font-semibold text-stone-700 dark:text-stone-300">
                                        {renderInline(col.trim())}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white dark:divide-stone-800 dark:bg-stone-900">
                            {bodyRows.map((row, rowIdx) => (
                                <tr key={rowIdx} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/50">
                                    {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-3 py-2 text-stone-600 dark:text-stone-400">
                                            {renderInline(cell.trim())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            inTable = false
            tableRows = []
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Table check: starts and ends with |
        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
            flushList()
            inTable = true
            const cells = trimmed
                .slice(1, -1)
                .split("|")
                .map((c) => c.trim())
            tableRows.push(cells)
            continue
        } else if (inTable) {
            flushTable()
        }

        // Headings
        if (trimmed.startsWith("#### ")) {
            flushList()
            elements.push(
                <h4 key={i} className="pt-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                    {renderInline(trimmed.slice(5))}
                </h4>
            )
            continue
        }
        if (trimmed.startsWith("### ")) {
            flushList()
            elements.push(
                <h3 key={i} className="pt-2 text-base font-bold text-stone-900 dark:text-stone-100">
                    {renderInline(trimmed.slice(4))}
                </h3>
            )
            continue
        }
        if (trimmed.startsWith("## ")) {
            flushList()
            elements.push(
                <h2 key={i} className="pt-3 text-lg font-bold text-stone-900 dark:text-stone-100">
                    {renderInline(trimmed.slice(3))}
                </h2>
            )
            continue
        }
        if (trimmed.startsWith("# ")) {
            flushList()
            elements.push(
                <h1 key={i} className="pt-3 text-xl font-bold text-stone-900 dark:text-stone-100">
                    {renderInline(trimmed.slice(2))}
                </h1>
            )
            continue
        }

        // Blockquotes
        if (trimmed.startsWith("> ")) {
            flushList()
            elements.push(
                <blockquote
                    key={i}
                    className="my-2 border-l-4 border-blue-500 bg-blue-50/50 py-1.5 pr-3 pl-4 text-sm text-stone-700 italic dark:bg-stone-800/40 dark:text-stone-300"
                >
                    {renderInline(trimmed.slice(2))}
                </blockquote>
            )
            continue
        }

        // Lists
        if (/^[-*]\s+/.test(trimmed)) {
            const itemText = trimmed.replace(/^[-*]\s+/, "")
            if (!listItems || listItems.type !== "ul") {
                flushList()
                listItems = { type: "ul", items: [itemText] }
            } else {
                listItems.items.push(itemText)
            }
            continue
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            const itemText = trimmed.replace(/^\d+\.\s+/, "")
            if (!listItems || listItems.type !== "ol") {
                flushList()
                listItems = { type: "ol", items: [itemText] }
            } else {
                listItems.items.push(itemText)
            }
            continue
        }

        // Empty line
        if (!trimmed) {
            flushList()
            continue
        }

        // Regular paragraph
        flushList()
        elements.push(
            <p key={i} className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {renderInline(line)}
            </p>
        )
    }

    flushList()
    flushTable()

    return elements
}
