import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { FeatureCard } from "@/components/FeatureCard";
import { TestimonialCard } from "@/components/TestimonialCard";
import { StatsCard } from "@/components/StatsCard";
import { PricingCard } from "@/components/PricingCard";
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
  Download,
  Mail,
  Smartphone,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// Import generated images
import dashboardPreview from "@/assets/dashboard-preview.jpg";
import heroInstruments from "@/assets/hero-instruments.jpg";
import abstractBg from "@/assets/abstract-bg.jpg";

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useSEO({
    title: "Gaugemaster — Advanced Asset Tracking System",
    description: "The most reliable asset tracking platform for enterprises. Monitor assets, automate maintenance, and optimize utilization.",
  });

  const features = [
    {
      title: "Real-Time Asset Monitoring",
      description: "Track assets with GPS, RFID, and IoT sensors to get live location and condition updates anytime, anywhere.",
      icon: Activity,
      badge: "Live Tracking",
    },
    {
      title: "Advanced Search & Filter",
      description: "Instantly locate assets across multiple sites with our lightning-fast search and filtering tools.",
      icon: Filter,
    },
    {
      title: "Maintenance Alerts",
      description: "Get notified of scheduled maintenance or unexpected issues to reduce downtime and extend asset life.",
      icon: BellRing,
      badge: "Proactive Alerts",
    },
    {
      title: "Comprehensive Reporting",
      description: "Generate detailed reports on asset utilization, condition, and maintenance history for compliance and analysis.",
      icon: FileText,
    },
    {
      title: "Mobile Access for Field Teams",
      description: "Empower your team with our mobile app to scan barcodes, update asset status, and sync data in real-time.",
      icon: Smartphone,
      badge: "Mobile App",
    },
    {
      title: "Enterprise-Grade Security",
      description: "Secure your data with encryption, role-based access, and full audit trails for peace of mind.",
      icon: Shield,
    },
  ];

  const testimonials = [
    {
      quote: "Gaugemaster has revolutionized our asset management process, saving us time and money with real-time tracking.",
      author: "John Doe",
      role: "Operations Manager",
      company: "LogiCorp",
      rating: 5,
    },
    {
      quote: "Our field teams love the mobile app. It's made asset audits and maintenance faster and more accurate.",
      author: "Jane Smith",
      role: "Field Supervisor",
      company: "EquipTrack Inc.",
      rating: 5,
    },
    {
      quote: "The reporting features give us unparalleled insights into asset performance across all locations.",
      author: "Michael Lee",
      role: "Fleet Manager",
      company: "TransGlobal",
      rating: 5,
    },
  ];

  const stats = [
    {
      value: "25,000+",
      label: "Assets Tracked",
      icon: Activity,
      trend: { value: "+30%", isPositive: true },
    },
    {
      value: "99.8%",
      label: "System Uptime",
      icon: CheckCircle,
    },
    {
      value: "700+",
      label: "Satisfied Clients",
      icon: Users,
      trend: { value: "+18%", isPositive: true },
    },
    {
      value: "24/7",
      label: "Support Availability",
      icon: Clock,
    },
  ];

  const pricingPlans = [
    {
      name: "Basic",
      price: "$59",
      period: "month",
      description: "Ideal for small businesses",
      features: [
        "Track up to 200 assets",
        "Basic alerts & notifications",
        "Standard reports",
        "Email support",
        "Mobile app access",
      ],
      buttonText: "Start Free Trial",
    },
    {
      name: "Business",
      price: "$199",
      period: "month",
      description: "For growing companies",
      features: [
        "Track up to 2,000 assets",
        "Advanced alerts & automation",
        "Custom reports & branding",
        "Priority support",
        "API access",
        "Advanced analytics",
        "Multi-location management",
      ],
      popular: true,
      buttonText: "Start Free Trial",
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "month",
      description: "For large organizations",
      features: [
        "Unlimited assets",
        "Dedicated account manager",
        "Custom integrations",
        "SSO & advanced security",
        "24/7 phone support",
        "On-premise deployment",
      ],
      buttonText: "Contact Sales",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2 font-bold text-xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Gauge className="h-5 w-5 text-white" />
            </div>
            Gaugemaster
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-primary transition-colors">Testimonials</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</a>
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/login">Get Started</Link>
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
              className="md:hidden border-t bg-background"
            >
              <nav className="px-6 py-4 space-y-4">
                <a
                  href="#features"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#testimonials"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Testimonials
                </a>
                <a
                  href="#pricing"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <div className="pt-4 space-y-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                  <Button size="sm" className="w-full" asChild>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div
            className="absolute inset-0 -z-10 opacity-20"
            style={{
              backgroundImage: `url(${abstractBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10" />

          <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge variant="secondary" className="mb-6">
                <Sparkles className="h-3 w-3 mr-1" />
                New: Real-Time GPS Tracking
              </Badge>

              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-6">
                Asset Tracking
                <span className="gradient-text block">made effortless</span>
              </h1>

              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                The most reliable platform to monitor and manage your assets.
                Track location, automate maintenance, and maximize efficiency.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button size="lg" className="group" asChild>
                  <Link to="/login">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Watch Demo</Link>
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  No credit card required
                </div>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={dashboardPreview}
                  alt="Gaugemaster Asset Tracking Dashboard"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              <motion.div
                className="absolute -top-4 -right-4 bg-white dark:bg-card rounded-xl p-4 shadow-lg border"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Live Asset Monitoring</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-muted/20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <StatsCard key={stat.label} {...stat} delay={index * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Everything you need for
                <span className="gradient-text"> perfect asset management</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                From AI-powered predictions to mobile access, we've built the most comprehensive
                asset tracking platform available.
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-8">
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

        {/* How it works */}
        <section className="py-20 bg-muted/20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                  Get started in minutes,
                  <span className="gradient-text"> not months</span>
                </h2>

                <div className="space-y-6">
                  {[
                    {
                      step: "01",
                      title: "Import Your Assets",
                      description: "Upload existing asset data via CSV or integrate with your current systems using our robust API.",
                    },
                    {
                      step: "02",
                      title: "Configure Tracking",
                      description: "Set monitoring parameters, assign responsible teams, and customize alert preferences for each asset.",
                    },
                    {
                      step: "03",
                      title: "Monitor & Optimize",
                      description: "Receive intelligent notifications, track performance in real-time, and generate detailed reports instantly.",
                    },
                  ].map((item, index) => (
                    <motion.div
                      key={item.step}
                      className="flex gap-4"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="relative"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <img
                  src={heroInstruments}
                  alt="Asset tracking equipment"
                  className="rounded-2xl shadow-2xl"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Trusted by leading
                <span className="gradient-text"> companies worldwide</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                See what our customers are saying about Gaugemaster
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-8">
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

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-muted/20">
          <div className="mx-auto max-w-7xl px-6">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Simple, transparent
                <span className="gradient-text"> pricing</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Choose the plan that fits your organization's needs
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {pricingPlans.map((plan, index) => (
                <PricingCard
                  key={plan.name}
                  {...plan}
                  delay={index * 0.1}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Ready to transform your
                <span className="gradient-text"> asset management?</span>
              </h2>

              <p className="text-xl text-muted-foreground mb-8">
                Join thousands of companies that trust Gaugemaster for their asset tracking needs.
                Start your free trial today – no credit card required.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="group" asChild>
                  <Link to="/login">
                    Start Free Trial
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Schedule Demo</Link>
                </Button>
              </div>

              <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Enterprise security
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  Setup in minutes
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/20 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 font-bold text-lg mb-4">
                <div className="h-6 w-6 rounded bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Gauge className="h-4 w-4 text-white" />
                </div>
                Gaugemaster
              </div>
              <p className="text-muted-foreground text-sm">
                The most advanced asset tracking platform for modern enterprises.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">API</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Mobile App</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">About</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Blog</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Careers</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Status</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Gaugemaster. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link to="/login" className="hover:text-primary transition-colors">Privacy</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Terms</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
