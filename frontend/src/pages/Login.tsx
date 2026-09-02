// pages/login.tsx
import { GalleryVerticalEnd, Gauge } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { LoginForm } from "@/Forms/login-form";
import { Link } from "react-router-dom";

import loginside from "@/assets/login-inside.png";

export default function LoginPage() {
  useSEO({
    title: "Sign In — Gaugemaster Calibration Management Portal",
    description:
      "Sign in to your Gaugemaster workspace to monitor gauge inventory, track calibration schedules, scan QR codes, and generate ISO compliance reports.",
    canonical: "https://gaugemaster.in/login",
  });

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg shadow-sm">
              <Gauge className="size-4" />
            </div>
            <span>Gaugemaster</span>
          </Link>
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
            alt="Gaugemaster Enterprise Calibration Platform"
            className="h-full w-full object-cover object-center dark:brightness-[0.8] dark:grayscale"
          />
        </div>
      </div>
    </div>
  );
}
