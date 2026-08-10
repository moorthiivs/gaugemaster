import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  delay?: number;
  badge?: string;
}

export function FeatureCard({ title, description, icon: Icon, delay = 0, badge }: FeatureCardProps) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 sm:p-7 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -6 }}
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-primary/10 blur-xl group-hover:bg-primary/20 transition-colors duration-500" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary border border-primary/20 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          {badge && (
            <Badge variant="outline" className="text-[10px] sm:text-xs font-medium border-primary/30 text-primary bg-primary/5">
              {badge}
            </Badge>
          )}
        </div>

        <h3 className="font-bold text-lg sm:text-xl mb-2 group-hover:text-primary transition-colors duration-300 tracking-tight">
          {title}
        </h3>

        <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
          {description}
        </p>
      </div>

      <div className="relative z-10 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/40 flex items-center text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span>Learn how it works</span>
        <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </motion.div>
  );
}