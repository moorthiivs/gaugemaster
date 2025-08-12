// pages/login.tsx
import { GalleryVerticalEnd } from "lucide-react"
import { useSEO } from "@/hooks/useSEO"
import { LoginForm } from "@/Forms/login-form"

import loginside from "@/assets/login-inside.png";

export default function LoginPage() {
  useSEO({
    title: "Login — Calibration Alerts",
    description: "Sign in to manage instrument calibrations and due dates.",
  })

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Calibration Alerts
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE IMAGE */}
      <div className="relative hidden lg:block bg-muted">
        <div className="absolute inset-0">
          <img
            src={loginside}
            alt="Calibration Illustration"
            className="h-full w-full object-cover object-center dark:brightness-[0.8] dark:grayscale"
          />
        </div>
      </div>
    </div>

  )
}
