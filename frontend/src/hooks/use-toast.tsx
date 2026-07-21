import * as React from "react"
import { toast as sonnerToast } from "sonner"

import {
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react"

export type ToastVariant =
  | "default"
  | "success"
  | "destructive"
  | "info"
  | "warning"
  | "loading"

export type ToastOptions = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
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

  const opts: {
    description?: string
    duration?: number
    icon?: React.ReactNode
  } = {}

  if (typeof description === "string") opts.description = description
  if (duration) opts.duration = duration


  switch (variant) {
    case "destructive":
      opts.icon = <XCircle className="h-5 w-5 text-red-600" />
      return sonnerToast.error(message, opts)

    case "success":
      opts.icon = <CheckCircle className="h-5 w-5 text-green-600" />
      return sonnerToast.success(message, opts)

    case "info":
      opts.icon = <Info className="h-5 w-5 text-blue-600" />
      return sonnerToast.info(message, opts)

    case "warning":
      opts.icon = <AlertTriangle className="h-5 w-5 text-yellow-600" />
      return sonnerToast.warning(message, opts)

    case "loading":
      opts.icon = <Loader2 className="h-5 w-5 animate-spin" />
      return sonnerToast.loading(message, opts)

    default:
      opts.icon = <Info className="h-5 w-5" />
      return sonnerToast(message, opts)
  }
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
