import { motion } from "framer-motion";
import { Star } from "lucide-react";

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
            className="group bg-card border rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5 }}
        >
            <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                    <Star
                        key={i}
                        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                            }`}
                    />
                ))}
            </div>

            <blockquote className="text-muted-foreground mb-6 leading-relaxed">
                "{quote}"
            </blockquote>

            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold">
                    {author.charAt(0)}
                </div>
                <div>
                    <div className="font-semibold text-sm">{author}</div>
                    <div className="text-xs text-muted-foreground">{role} at {company}</div>
                </div>
            </div>
        </motion.div>
    );
}