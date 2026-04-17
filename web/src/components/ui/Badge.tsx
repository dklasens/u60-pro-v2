import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium",
        variant === "default" &&
          "bg-accent/10 text-accent",
        variant === "success" &&
          "bg-success/10 text-success",
        variant === "error" &&
          "bg-error/10 text-error",
        variant === "warning" &&
          "bg-warning/10 text-warning",
        className
      )}
    >
      {children}
    </span>
  );
}
