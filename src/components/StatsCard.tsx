import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
    value: string;
    label: string;
    icon: LucideIcon;
    trend?: {
        value: string;
        isPositive: boolean;
    };
    delay?: number;
}

export function StatsCard({ value, label, icon: Icon, trend, delay = 0 }: StatsCardProps) {
    return (
        <motion.div
            className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -2 }}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"
                        }`}>
                        <span>{trend.isPositive ? "↗" : "↘"}</span>
                        {trend.value}
                    </div>
                )}
            </div>

            <div>
                <div className="text-2xl font-bold mb-1 group-hover:text-primary transition-colors duration-300">
                    {value}
                </div>
                <div className="text-sm text-muted-foreground">
                    {label}
                </div>
            </div>
        </motion.div>
    );
}