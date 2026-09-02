import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { FeatureCard } from "@/components/FeatureCard";
import { TestimonialCard } from "@/components/TestimonialCard";
import { StatsCard } from "@/components/StatsCard";
import { PricingCard } from "@/components/PricingCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BellRing,
  Filter,
  FileText,
  Activity,
  Shield,
  Zap,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Gauge,
  Smartphone,
  Menu,
  X,
  Building,
  Building2,
  Factory,
  Minus,
  Plus,
  Calculator,
  Play,
  Star,
  Layers,
  Cpu,
  Award,
  Globe,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// Import generated images
import dashboardPreview from "@/assets/dashboard-preview.png";
import heroInstruments from "@/assets/hero-instruments.jpg";
import abstractBg from "@/assets/abstract-bg.jpg";

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plantCount, setPlantCount] = useState<number>(1);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const faqs = [
    {
      question: "What is Gaugemaster and what does it do?",
      answer:
        "Gaugemaster is an enterprise-grade cloud calibration management and asset tracking SaaS platform designed for manufacturing plants, automotive engineering teams, and quality crib managers. It centralizes instrument master lists, automates calibration schedule alerts, tracks tool locations, ensures ISO 9001 / IATF 16949 audit compliance, and enables instant mobile QR-code scanning right on the shop floor.",
    },
    {
      question: "How does Gaugemaster ensure ISO 9001 and IATF 16949 compliance?",
      answer:
        "Gaugemaster maintains complete, immutable digital audit trails for every gauge calibration, tolerance approval, digital certificate generation, and user modification. It tracks calibration due dates proactively, automatically prevents the deployment of expired instruments on production lines, and exports one-click audit-ready compliance dossiers.",
    },
    {
      question: "Can shop floor inspectors use mobile devices and QR code scanning?",
      answer:
        "Yes! Every instrument in Gaugemaster has a unique, high-resolution QR code. Shop-floor inspectors and machine operators can scan gauge QR codes using any mobile smartphone, tablet, or handheld terminal to instantly check validity status, log measurement readings, issue calibration requests, or review historical certificates.",
    },
    {
      question: "How do automated calibration alerts and escalation matrices work?",
      answer:
        "Gaugemaster features an automated multi-tier alert engine. It dispatches proactive notifications at 30, 15, 7, and 1 day prior to calibration expiry via email, SMS, and in-app dashboard badges. If a gauge passes its due date, it is highlighted in red as overdue and escalated to plant quality heads to guarantee zero-defect manufacturing.",
    },
    {
      question: "Can we import existing Excel catalogs or integrate with SAP & ERP?",
      answer:
        "Absolutely. Gaugemaster includes an intelligent bulk Excel/CSV importer with automatic column mapping to migrate thousands of tool records in minutes. Enterprise plans also offer robust REST APIs and webhook connectors to seamlessly sync inventory, statuses, and work orders with SAP, Oracle, or custom ERP systems.",
    },
    {
      question: "How does multi-plant and multi-department licensing work?",
      answer:
        "Gaugemaster is built from the ground up for multi-plant enterprise hierarchies. Super-administrators can supervise multiple manufacturing facilities from a single global cockpit, assign granular department permissions (Quality, Tool Crib, Production, Maintenance), and generate consolidated cross-facility calibration KPI reports.",
    },
  ];

  useSEO({
    title: "Gaugemaster — #1 Gauge Management & Calibration Tracking Software",
    description:
      "Enterprise calibration management software for manufacturing quality teams. Automate calibration schedules, track gauge inventory, scan QR codes, and pass ISO 9001/IATF 16949 audits with 100% compliance.",
    keywords:
      "gauge management software, calibration management system, calibration tracking software, asset tracking software, calibration schedule software, ISO 9001 calibration tracking, IATF 16949 compliance, tool crib management, equipment calibration tracking, gauge calibration app",
    canonical: "https://gaugemaster.iviewsense.com/",
    ogImage: "https://gaugemaster.iviewsense.com/og-image.png",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": "https://gaugemaster.iviewsense.com/#webpage",
        "url": "https://gaugemaster.iviewsense.com/",
        "name": "Gaugemaster — #1 Gauge Management & Calibration Tracking Software",
        "description":
          "The leading calibration management SaaS platform. Automate instrument calibration schedules, QR code tracking, and ISO 9001/IATF 16949 audit compliance.",
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://gaugemaster.iviewsense.com/",
            },
          ],
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer,
          },
        })),
      },
    ],
  });

  const features = [
    {
      title: "Real-Time Asset Monitoring",
      description: "Track equipment with GPS, RFID, and IoT sensors to get live location, calibration, and condition updates 24/7.",
      icon: Activity,
      badge: "Live Tracking",
    },
    {
      title: "Instant Search & Filtering",
      description: "Locate specific gauges, tools, and instruments across multiple plant sites in milliseconds.",
      icon: Filter,
      badge: "Fast Search",
    },
    {
      title: "Automated Maintenance Alerts",
      description: "Receive proactive notifications for upcoming calibration dates and prevent uncalibrated tool usage.",
      icon: BellRing,
      badge: "Proactive Alerts",
    },
    {
      title: "Compliance & Audit Reports",
      description: "Generate ISO-compliant audit trails, calibration certificates, and history logs with one click.",
      icon: FileText,
      badge: "1-Click Audit",
    },
    {
      title: "Mobile App & QR Code Scanner",
      description: "Empower shop-floor inspectors to scan QR codes on gauges, update status, and issue certificates instantly.",
      icon: Smartphone,
      badge: "Mobile App",
    },
    {
      title: "Enterprise Security & SSO",
      description: "Bank-grade data encryption, granular role-based access control (RBAC), and detailed security audit logs.",
      icon: Shield,
      badge: "SOC2 Ready",
    },
  ];

  const testimonials = [
    {
      quote: "Gaugemaster eliminated 100% of our manual calibration paperwork. Our annual ISO audit was completed in half the time.",
      author: "Rajesh Kumar",
      role: "VP of Quality Assurance",
      company: "LogiCorp Precision",
      rating: 5,
    },
    {
      quote: "The multi-plant overview and mobile QR scanner transformed how our inspectors work across 4 manufacturing sites.",
      author: "Sarah Jenkins",
      role: "Operations Supervisor",
      company: "TransGlobal Aerospace",
      rating: 5,
    },
    {
      quote: "Predictive alerts saved us from a costly production halt. It paid for itself within the first two weeks of rollout.",
      author: "Michael Chang",
      role: "Plant Director",
      company: "Apex Precision Tools",
      rating: 5,
    },
  ];

  const stats = [
    {
      value: "25,000+",
      label: "Active Assets Tracked",
      icon: Activity,
      trend: { value: "+30% YoY", isPositive: true },
    },
    {
      value: "99.8%",
      label: "On-Time Calibration Rate",
      icon: CheckCircle,
      trend: { value: "+14.2%", isPositive: true },
    },
    {
      value: "700+",
      label: "Manufacturing Facilities",
      icon: Users,
      trend: { value: "+18% YoY", isPositive: true },
    },
    {
      value: "24/7",
      label: "Enterprise SLA Support",
      icon: Clock,
    },
  ];

  const pricingPlans = [
    {
      name: "SME Plan",
      price: "₹2,500",
      pricePerUnit: "per month per plant",
      totalCalculated: `₹${(2500 * plantCount).toLocaleString("en-IN")}`,
      plantCount,
      description: "Ideal for small & medium manufacturing plants",
      badgeText: "SME / Basic",
      icon: <Building className="h-5 w-5 text-blue-500" />,
      features: [
        "Up to 1 Plant Location included",
        "Up to 500 Gauge & Equipment Assets",
        "Calibration & Maintenance Scheduling",
        "Real-time Status & Expiry Alerts",
        "Standard Audit Reports & Certificate Exports",
        "Standard Email Support",
      ],
      buttonText: "Start Free Trial",
    },
    {
      name: "Business Plan",
      price: "₹3,500",
      pricePerUnit: "per month per plant",
      totalCalculated: `₹${(3500 * plantCount).toLocaleString("en-IN")}`,
      plantCount,
      description: "For growing multi-department & multi-site facilities",
      badgeText: "Most Popular",
      popular: true,
      icon: <Building2 className="h-5 w-5 text-primary" />,
      features: [
        "Multi-Department Plant Management",
        "Up to 2,500 Gauge & Asset Records per plant",
        "Advanced AI Calibration & Maintenance Workflows",
        "Custom Preventive Alerts & Escalation Matrix",
        "Automated Audit Trails & Compliance Reports",
        "Mobile App for Field Inspectors & QR Scanning",
        "Priority Email & Chat Support",
      ],
      buttonText: "Start Free Trial",
    },
    {
      name: "Corporate Plan",
      price: "₹6,000",
      pricePerUnit: "per month per plant",
      totalCalculated: `₹${(6000 * plantCount).toLocaleString("en-IN")}`,
      plantCount,
      description: "For large enterprise multi-plant operations",
      badgeText: "Enterprise Grade",
      icon: <Factory className="h-5 w-5 text-purple-500" />,
      features: [
        "Unlimited Assets & Equipment Records per plant",
        "Centralized Multi-Plant Dashboard",
        "Enterprise SSO & Custom Audit Logs",
        "Custom SAP / ERP Software Integrations",
        "Dedicated Account Manager & Onsite Setup",
        "24/7 SLA Priority Phone & Online Support",
        "On-Premise or Private Cloud Deployment",
      ],
      buttonText: "Contact Sales",
    },
  ];

  const trustLogos = [
    "LOGICORP",
    "TRANSGLOBAL",
    "PRECISION TECH",
    "APEX AERO",
    "AUTOEQUIP",
    "NEXUS MFG",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-all">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2.5 font-bold text-xl cursor-pointer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-primary/20 ring-1 ring-white/20">
              <Gauge className="h-5 w-5 text-white" />
            </div>
            <span className="font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70">
              Gaugemaster
            </span>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">How It Works</a>
            <a href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Testimonials</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Pricing</a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">FAQ</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" size="sm" className="rounded-full font-semibold border-border/80 hover:border-primary/50 hover:bg-card px-5" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" variant="hero" className="rounded-full font-semibold px-5 shadow-sm shadow-primary/20" asChild>
              <Link to="/login">Get Started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground hover:bg-muted rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t bg-background/95 backdrop-blur-lg"
            >
              <nav className="px-6 py-5 space-y-4" aria-label="Mobile Navigation">
                <a
                  href="#features"
                  className="block text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  className="block text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How It Works
                </a>
                <a
                  href="#testimonials"
                  className="block text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Testimonials
                </a>
                <a
                  href="#pricing"
                  className="block text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  className="block text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </a>
                <div className="pt-4 border-t space-y-2">
                  <Button variant="outline" size="sm" className="rounded-full w-full" asChild>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                  <Button size="sm" variant="hero" className="rounded-full w-full" asChild>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-24 lg:pt-20 lg:pb-32">
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-12 gap-8 lg:gap-8 items-center">
            {/* Left Content */}
            <motion.div
              className="lg:col-span-6 flex flex-col items-start text-left"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Shimmer Announcement Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-5 sm:mb-6 hover:bg-primary/15 transition-all shadow-sm cursor-pointer group">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                <span className="truncate max-w-[240px] sm:max-w-none">#1 Enterprise Calibration &amp; Gauge Management Platform</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] sm:leading-[1.1] mb-5 sm:mb-6">
                Asset Tracking &amp; Calibration
                <span className="block mt-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">
                  made effortless &amp; precise
                </span>
              </h1>

              <p className="text-base sm:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-xl">
                The all-in-one software platform for manufacturing &amp; quality engineering teams. Monitor location, automate calibration schedules, scan QR codes, and ensure 100% ISO 9001 &amp; IATF 16949 audit compliance.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto mb-8 sm:mb-10">
                <Button
                  size="lg"
                  variant="hero"
                  className="rounded-full h-12 sm:h-13 px-8 text-base font-semibold shadow-xl shadow-primary/25 group w-full sm:w-auto"
                  asChild
                >
                  <Link to="/login">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1.5 transition-transform" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full h-12 sm:h-13 px-8 text-base font-semibold border-primary/40 bg-card/80 hover:bg-card hover:border-primary text-foreground backdrop-blur-md shadow-md group transition-all w-full sm:w-auto"
                  onClick={() => setDemoModalOpen(true)}
                >
                  <Play className="h-4 w-4 mr-2.5 text-primary fill-primary/20 group-hover:scale-110 transition-transform" />
                  Watch 2-Min Demo
                </Button>
              </div>

              {/* Micro Trust Indicators */}
              <div className="flex flex-wrap items-center gap-y-2.5 gap-x-5 text-xs sm:text-sm text-muted-foreground pt-4 border-t border-border/40 w-full">
                <div className="flex items-center gap-1.5">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                    ))}
                  </div>
                  <span className="font-bold text-foreground">4.9/5</span>
                  <span>(700+ Plants)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>14-Day Free Trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>No Credit Card</span>
                </div>
              </div>
            </motion.div>

            {/* Right Interactive Window Preview */}
            <motion.div
              className="lg:col-span-6 relative"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-30 blur-2xl -z-10 animate-pulse" />

              {/* macOS Window Frame */}
              <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-card shadow-2xl ring-1 ring-white/10">
                <div className="h-9 sm:h-10 bg-muted/60 backdrop-blur-sm border-b border-border/50 px-3 sm:px-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-rose-500/80" />
                    <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-500/80" />
                    <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-mono text-muted-foreground/80 bg-background/50 px-2.5 py-0.5 rounded-full border border-border/40 flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-none">
                    <Shield className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="truncate">app.gaugemaster.iviewsense.com/live-dashboard</span>
                  </div>
                  <div className="w-8 sm:w-12" />
                </div>

                <div className="relative">
                  <img
                    src={dashboardPreview}
                    alt="Gaugemaster Enterprise Calibration Dashboard and Asset Tracking Portal"
                    className="w-full h-auto object-cover"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Floating Dynamic Glass Cards */}
              <motion.div
                className="absolute -top-4 -right-2 hidden sm:flex items-center gap-3 bg-card/90 backdrop-blur-md rounded-xl p-3 shadow-xl border border-border/80 ring-1 ring-white/10"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-ping" />
                <div>
                  <div className="text-xs font-bold">25,000+ Assets Active</div>
                  <div className="text-[10px] text-muted-foreground">Live Telemetry Synced</div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-4 -left-2 hidden sm:flex items-center gap-3 bg-card/90 backdrop-blur-md rounded-xl p-3 shadow-xl border border-border/80 ring-1 ring-white/10"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">99.8% On-Time Calibration</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">ISO 9001 &amp; IATF Compliant</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Trusted By Logos Banner */}
        <section className="py-8 sm:py-10 border-y border-border/40 bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center">
            <p className="text-[10px] sm:text-xs font-bold tracking-widest text-muted-foreground uppercase mb-5">
              TRUSTED BY 700+ MANUFACTURING &amp; QUALITY LEADERS WORLDWIDE
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:flex flex-wrap justify-center items-center gap-6 sm:gap-12 opacity-80">
              {trustLogos.map((logo) => (
                <div key={logo} className="flex items-center justify-center gap-2 font-black text-base sm:text-lg tracking-tighter text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer">
                  <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-primary/70" />
                  <span>{logo}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {stats.map((stat, index) => (
                <StatsCard key={stat.label} {...stat} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 sm:py-20 bg-muted/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div
              className="text-center mb-12 sm:mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-3.5 px-3 py-1 text-xs border-primary/30 text-primary bg-primary/5">
                ⚡ POWERFUL CAPABILITIES
              </Badge>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3.5">
                Everything you need for
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">
                  zero-downtime asset &amp; gauge management
                </span>
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                From real-time GPS tracking to automated calibration workflows, we empower shop floors with enterprise precision.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
              {features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  {...feature}
                  delay={index * 0.1}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-24 border-y border-border/40 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <motion.div
                className="lg:col-span-6"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Badge variant="outline" className="mb-3.5 px-3 py-1 text-xs border-primary/30 text-primary bg-primary/5">
                  🛠️ FAST &amp; EFFORTLESS SETUP
                </Badge>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 sm:mb-6">
                  Get started in minutes,
                  <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
                    not months
                  </span>
                </h2>

                <div className="space-y-6 sm:space-y-8 mt-6 sm:mt-8">
                  {[
                    {
                      step: "01",
                      title: "Import Your Gauge & Asset Data",
                      description: "Upload existing CSV asset catalogs or integrate directly with your ERP/SAP software via our REST API.",
                    },
                    {
                      step: "02",
                      title: "Automate Calibration Schedules",
                      description: "Set smart frequency intervals, assign responsible calibration teams, and configure escalation alert matrix.",
                    },
                    {
                      step: "03",
                      title: "Monitor, Scan & Pass Audits",
                      description: "Inspectors use our mobile app to scan QR codes on shop floors, log measurements, and export instant ISO audit reports.",
                    },
                  ].map((item, index) => (
                    <motion.div
                      key={item.step}
                      className="flex gap-4 sm:gap-5"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white font-extrabold text-base sm:text-lg shadow-md shadow-primary/20">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="font-bold text-base sm:text-lg mb-1">{item.title}</h3>
                        <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="lg:col-span-6 relative"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="relative rounded-2xl overflow-hidden border border-border/60 shadow-2xl group">
                  <img
                    src={heroInstruments}
                    alt="Precision gauge instruments tracking and shop floor calibration management"
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80" />
                  <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-4 sm:p-6 rounded-xl bg-card/80 backdrop-blur-md border border-border/60">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-500">Live Shop Floor Sync</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-snug">
                      "Real-time QR scanning cut tool issue times by 65% across all 3 shift changes."
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div
              className="text-center mb-12 sm:mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-3.5 px-3 py-1 text-xs border-primary/30 text-primary bg-primary/5">
                💬 CUSTOMER SUCCESS
              </Badge>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3.5">
                Trusted by manufacturing leaders
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">
                  worldwide
                </span>
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Discover why quality assurance directors and plant managers rely on Gaugemaster every day.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
              {testimonials.map((testimonial, index) => (
                <TestimonialCard
                  key={testimonial.author}
                  {...testimonial}
                  delay={index * 0.1}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section with Plant Calculator */}
        <section id="pricing" className="py-16 sm:py-24 bg-muted/20 border-t border-border/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div
              className="text-center mb-10 sm:mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-3.5 px-3 py-1 text-xs border-primary/30 text-primary bg-primary/5">
                🏷️ TRANSPARENT PLANT PRICING
              </Badge>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3.5">
                Simple, predictable
                <span className="gradient-text"> per-plant pricing</span>
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Select your plan and number of plants to instantly view your estimated monthly investment.
              </p>
            </motion.div>

            {/* Interactive Plant Calculator Bar */}
            <motion.div
              className="max-w-2xl mx-auto mb-12 sm:mb-16 p-4 sm:p-6 rounded-2xl bg-card border border-border/60 shadow-lg backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-center sm:text-left">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 hidden sm:block">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs sm:text-sm block">Number of Plants / Manufacturing Sites</span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">Adjust count to view total monthly rate</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center border border-border/80 rounded-xl overflow-hidden bg-background shadow-inner">
                    <button
                      type="button"
                      onClick={() => setPlantCount(Math.max(1, plantCount - 1))}
                      className="p-2 sm:p-2.5 hover:bg-muted transition-colors disabled:opacity-40"
                      disabled={plantCount <= 1}
                      aria-label="Decrease plant count"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-4 font-extrabold text-base min-w-[2.5rem] text-center text-primary">
                      {plantCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPlantCount(plantCount + 1)}
                      className="p-2 sm:p-2.5 hover:bg-muted transition-colors"
                      aria-label="Increase plant count"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[1, 3, 5, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPlantCount(preset)}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs rounded-lg border font-semibold transition-all ${
                          plantCount === preset
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background hover:bg-muted text-muted-foreground border-border/60"
                        }`}
                      >
                        {preset} {preset === 1 ? "Plant" : "Plants"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-stretch">
              {pricingPlans.map((plan, index) => (
                <PricingCard
                  key={plan.name}
                  {...plan}
                  delay={index * 0.1}
                />
              ))}
            </div>

            <motion.div
              className="mt-10 sm:mt-12 text-center text-xs sm:text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>30-day free trial on all plans</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Cancel or scale plants anytime</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section (Rich Snippets & Google Ranking Accelerator) */}
        <section id="faq" className="py-16 sm:py-24 border-t border-border/40 bg-card/20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <motion.div
              className="text-center mb-12 sm:mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-3.5 px-3 py-1 text-xs border-primary/30 text-primary bg-primary/5">
                ❓ FREQUENTLY ASKED QUESTIONS
              </Badge>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3.5">
                Got questions?
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">
                  We've got clear answers
                </span>
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to know about Gaugemaster calibration tracking, ISO compliance, and shop floor implementation.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 sm:p-8 shadow-xl"
            >
              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="border border-border/40 rounded-xl px-4 sm:px-6 data-[state=open]:border-primary/40 data-[state=open]:bg-primary/5 transition-all"
                  >
                    <AccordionTrigger className="text-left font-bold text-sm sm:text-base hover:no-underline py-4">
                      <div className="flex items-center gap-3">
                        <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                        <span>{faq.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-1 pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-indigo-600/10 to-purple-600/15 -z-10" />
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-4 sm:mb-6 px-3.5 sm:px-4 py-1 text-xs font-semibold border-primary/40 text-primary bg-primary/10">
                🚀 JOIN HUNDREDS OF PLANTS
              </Badge>

              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 sm:mb-6">
                Ready to transform your
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600">
                  asset management &amp; calibration?
                </span>
              </h2>

              <p className="text-sm sm:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
                Join 700+ manufacturing facilities that trust Gaugemaster for zero-downtime asset tracking. Start your 30-day free trial today.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="hero"
                  className="rounded-full h-12 sm:h-13 px-8 sm:px-9 text-base font-semibold shadow-xl shadow-primary/30 group w-full sm:w-auto"
                  asChild
                >
                  <Link to="/login">
                    Start Free Trial Now
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1.5 transition-transform" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full h-12 sm:h-13 px-8 text-base font-semibold border-primary/40 bg-card/80 hover:bg-card hover:border-primary text-foreground backdrop-blur-md shadow-md transition-all w-full sm:w-auto"
                  asChild
                >
                  <Link to="/login">Schedule Guided Demo</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Demo Video Modal Overlay */}
      <AnimatePresence>
        {demoModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDemoModalOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-4xl bg-card rounded-2xl border border-border/80 overflow-hidden shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3.5 sm:p-4 bg-muted/60 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm truncate">
                  <Play className="h-4 w-4 text-primary fill-primary shrink-0" />
                  <span className="truncate">Gaugemaster — Interactive Product Overview</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative aspect-video bg-black flex items-center justify-center">
                <img
                  src={dashboardPreview}
                  alt="Gaugemaster Product Demo and Software Walkthrough"
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                  <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30 mb-3 sm:mb-4 cursor-pointer hover:scale-110 transition-transform">
                    <Play className="h-5 w-5 sm:h-7 sm:w-7 fill-current ml-1" />
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-white mb-1.5 sm:mb-2">Live Demo &amp; Product Walkthrough</h3>
                  <p className="text-xs sm:text-sm text-gray-300 max-w-md">
                    Explore real-time GPS asset tracking, automated calibration alerts, and QR code mobile scanning in action.
                  </p>
                  <Button size="sm" variant="hero" className="rounded-full mt-4 sm:mt-5" asChild onClick={() => setDemoModalOpen(false)}>
                    <Link to="/login">Start Free Trial Now</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/40 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10 sm:mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 font-bold text-lg mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white">
                  <Gauge className="h-4 w-4" />
                </div>
                <span>Gaugemaster</span>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mb-5 leading-relaxed">
                The premier enterprise platform for asset tracking, gauge calibration management, and ISO compliance automation.
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full w-fit border border-emerald-500/20">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational (99.98% Uptime)
              </div>
            </div>

            <div>
              <h3 className="font-bold text-xs sm:text-sm mb-3 sm:mb-4 tracking-tight">Product</h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Mobile App</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xs sm:text-sm mb-3 sm:mb-4 tracking-tight">Solutions</h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">Calibration Tracking</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Tool &amp; Gauge Cribs</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">ISO Audit Readiness</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Preventive Maintenance</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Enterprise SLA</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-xs sm:text-sm mb-3 sm:mb-4 tracking-tight">Company</h3>
              <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">About Us</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Customer Stories</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Security &amp; Trust</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Contact Support</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/40 pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[11px] sm:text-xs text-muted-foreground text-center sm:text-left">
              &copy; {new Date().getFullYear()} Gaugemaster Platform Inc. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs text-muted-foreground">
              <Link to="/login" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Security Whitepaper</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
