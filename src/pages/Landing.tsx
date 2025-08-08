import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";

export default function Landing() {
  useSEO({
    title: "Calibration Alerts — Track Instrument Due Dates",
    description: "Monitor calibration schedules, get alerts, and stay compliant.",
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Calibration Alerts</div>
          </div>
          <nav className="flex items-center gap-4">
            <a href="#features" className="text-sm text-muted-foreground hover:underline">Features</a>
            <a href="#how" className="text-sm text-muted-foreground hover:underline">How it works</a>
            <Button asChild>
              <a href="/login" aria-label="Sign in">Sign in</a>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-surface)" }} />
          <div className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                Calibration alerts for every instrument
              </h1>
              <p className="mt-4 text-muted-foreground text-lg">
                Stay ahead of due dates, prevent overdue equipment, and keep audits stress-free.
              </p>
              <div className="mt-6 flex gap-3">
                <Button asChild>
                  <a href="/login">Get started</a>
                </Button>
                <Button variant="secondary" asChild>
                  <a href="#features">Learn more</a>
                </Button>
              </div>
            </div>
            <div className="rounded-xl border p-6 shadow-sm bg-card">
              <div className="text-sm text-muted-foreground">Preview</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-4">
                  <div className="font-medium">Total instruments</div>
                  <div className="text-2xl font-bold">248</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="font-medium">Overdue</div>
                  <div className="text-2xl font-bold text-destructive">12</div>
                </div>
                <div className="rounded-md border p-4 col-span-2">
                  <div className="font-medium">Next calibration</div>
                  <div className="text-xl">Sep 20, 2025</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-3 gap-6">
          <article className="rounded-lg border p-6">
            <h2 className="font-semibold">Smart reminders</h2>
            <p className="mt-2 text-muted-foreground">Email alerts before due dates so nothing slips through.</p>
          </article>
          <article className="rounded-lg border p-6">
            <h2 className="font-semibold">Powerful filters</h2>
            <p className="mt-2 text-muted-foreground">Find instruments by status, location, or frequency fast.</p>
          </article>
          <article className="rounded-lg border p-6">
            <h2 className="font-semibold">Audit-ready reports</h2>
            <p className="mt-2 text-muted-foreground">Generate CSV/PDF reports for audits and management.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
