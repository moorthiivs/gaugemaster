import * as React from "react"
import { toast as sonnerToast } from "sonner"

export type ToastOptions = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  duration?: number
}

function showToast({ title, description, variant = "default", duration }: ToastOptions) {
  const message =
    typeof title === "string"
      ? title
      : title
      ? (title as any).toString?.() ?? ""
      : variant === "destructive"
      ? "Error"
      : "Notice"

  const opts: { description?: string; duration?: number } = {}
  if (typeof description === "string") opts.description = description
  if (duration) opts.duration = duration

  if (variant === "destructive") {
    return sonnerToast.error(message, opts)
  }
  return sonnerToast.success(message, opts)
}

export function useToast() {
  return React.useMemo(
    () => ({
      toast: showToast,
      dismiss: (id?: string) => sonnerToast.dismiss(id),
    }),
    []
  )
}

export const toast = showToast

