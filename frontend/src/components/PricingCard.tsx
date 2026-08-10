import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface PricingCardProps {
  name: string;
  price: string;
  pricePerUnit: string;
  totalCalculated?: string;
  plantCount?: number;
  description: string;
  features: string[];
  popular?: boolean;
  badgeText?: string;
  buttonText: string;
  delay?: number;
  icon?: React.ReactNode;
}

export function PricingCard({
  name,
  price,
  pricePerUnit,
  totalCalculated,
  plantCount = 1,
  description,
  features,
  popular,
  badgeText,
  buttonText,
  delay = 0,
  icon,
}: PricingCardProps) {
  return (
    <motion.div
      className={`relative flex flex-col justify-between bg-card rounded-2xl p-5 sm:p-8 transition-all duration-300 ${
        popular
          ? "border-2 border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/20 scale-100 lg:scale-105 bg-gradient-to-b from-card via-card to-primary/5"
          : "border border-border shadow-sm hover:shadow-md hover:border-border/80"
      }`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -6 }}
    >
      {badgeText && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge variant={popular ? "premium" : "secondary"} className="px-4 py-1 font-semibold text-xs shadow-md">
            {badgeText}
          </Badge>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`p-2.5 rounded-xl ${popular ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight">{name}</h3>
              <p className="text-xs text-muted-foreground font-medium">{description}</p>
            </div>
          </div>
        </div>

        <div className="my-5 sm:my-6 p-3.5 sm:p-4 rounded-xl bg-muted/40 border border-muted/60 text-center">
          <div className="flex flex-wrap items-baseline justify-center gap-1">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">{price}</span>
            <span className="text-xs sm:text-sm text-muted-foreground font-medium">{pricePerUnit}</span>
          </div>
          {plantCount > 1 && totalCalculated && (
            <div className="mt-2 pt-2 border-t border-border/50 text-xs font-semibold text-primary">
              Total: {totalCalculated} / month ({plantCount} plants)
            </div>
          )}
        </div>

        <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2.5 sm:gap-3">
              <div className="flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground leading-snug sm:leading-tight">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        className="w-full rounded-full font-semibold group h-11 sm:h-12 text-sm sm:text-base"
        variant={popular ? "hero" : "outline"}
        size="lg"
        asChild
      >
        <Link to="/login">
          {buttonText}
          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Link>
      </Button>
    </motion.div>
  );
}