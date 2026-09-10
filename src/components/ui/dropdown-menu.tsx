import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const DropdownContext = React.createContext<{
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
} | null>(null)

function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    return <DropdownContext.Provider value={{ open, setOpen }}>{children}</DropdownContext.Provider>
}

function DropdownMenuTrigger({ asChild = false, children, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
    const context = React.useContext(DropdownContext)
    if (!context) throw new Error("DropdownMenuTrigger must be used inside DropdownMenu")
    const Comp = asChild ? Slot.Root : "button"
    return <Comp type="button" aria-expanded={context.open} onClick={() => context.setOpen((value) => !value)} {...props}>{children}</Comp>
}

function DropdownMenuContent({ className, children, ...props }: React.ComponentProps<"div"> & { align?: "start" | "center" | "end" }) {
    const context = React.useContext(DropdownContext)
    if (!context?.open) return null
    return <div role="menu" className={cn("absolute z-50 mt-2 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props}>{children}</div>
}

function DropdownMenuItem({ className, onClick, ...props }: React.ComponentProps<"button">) {
    const context = React.useContext(DropdownContext)
    return <button type="button" role="menuitem" className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent", className)} onClick={(event) => { onClick?.(event); context?.setOpen(false) }} {...props} />
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger }
