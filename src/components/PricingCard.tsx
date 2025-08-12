import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface PricingCardProps {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    popular?: boolean;
    buttonText: string;
    delay?: number;
}

export function PricingCard({
    name,
    price,
    period,
    description,
    features,
    popular,
    buttonText,
    delay = 0
}: PricingCardProps) {
    return (
        <motion.div
            className={`relative bg-card border rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 ${popular ? 'border-primary shadow-lg scale-105' : ''
                }`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5 }}
        >
            {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="premium" className="px-4 py-1">
                        Most Popular
                    </Badge>
                </div>
            )}

            <div className="text-center mb-8">
                <h3 className="text-xl font-bold mb-2">{name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{description}</p>

                <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{price}</span>
                    <span className="text-muted-foreground">/{period}</span>
                </div>
            </div>

            <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm">{feature}</span>
                    </li>
                ))}
            </ul>

            <Button
                className="w-full"
                variant={popular ? "hero" : "outline"}
                size="lg"
            >
                {buttonText}
            </Button>
        </motion.div>
    );
}