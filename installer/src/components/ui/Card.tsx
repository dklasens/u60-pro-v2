import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card p-6 transition-all duration-300",
        hover && "hover:-translate-y-0.5 hover:border-white/12",
        className
      )}
    >
      {children}
    </div>
  );
}
