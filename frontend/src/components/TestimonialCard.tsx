import { motion } from "framer-motion";
import { Star, ShieldCheck } from "lucide-react";

interface TestimonialProps {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating: number;
  delay?: number;
}

export function TestimonialCard({ quote, author, role, company, rating, delay = 0 }: TestimonialProps) {
  return (
    <motion.div
      className="group relative flex flex-col justify-between bg-card/80 backdrop-blur-md border border-border/60 rounded-2xl p-5 sm:p-7 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -6 }}
    >
      <div className="absolute -top-4 -right-4 h-20 w-20 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors" />

      <div>
        {/* Top bar with rating and verified badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-5">
          <div className="flex items-center gap-1.5">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                    i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-muted-foreground">5.0</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-emerald-500/20 shadow-sm">
            <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
            <span>Verified Client</span>
          </div>
        </div>

        {/* Quote content */}
        <blockquote className="text-foreground/90 text-xs sm:text-base leading-relaxed mb-5 sm:mb-6 italic font-medium">
          "{quote}"
        </blockquote>
      </div>

      {/* Author info footer */}
      <div className="flex items-center gap-3 sm:gap-3.5 pt-3.5 sm:pt-4 border-t border-border/40">
        <div className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 rounded-full bg-gradient-to-tr from-primary via-indigo-600 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs sm:text-sm shadow-md ring-2 ring-background">
          {author.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate">
            {author}
          </div>
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">
            {role} • <span className="text-foreground/80 font-semibold">{company}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}