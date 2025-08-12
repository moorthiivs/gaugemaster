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
            className="group relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5 }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                    {badge && (
                        <Badge variant="secondary" className="text-xs">
                            {badge}
                        </Badge>
                    )}
                </div>

                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors duration-300">
                    {title}
                </h3>

                <p className="text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>
        </motion.div>
    );
}