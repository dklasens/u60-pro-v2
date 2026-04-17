import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  type?: "info" | "warning" | "success";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const icons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

const styles = {
  info: "border-accent/30 bg-accent/5",
  warning: "border-warning/30 bg-warning/5",
  success: "border-success/30 bg-success/5",
};

const iconColors = {
  info: "text-accent",
  warning: "text-warning",
  success: "text-success",
};

export function Callout({
  type = "info",
  title,
  children,
  className,
}: CalloutProps) {
  const Icon = icons[type];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        styles[type],
        className
      )}
    >
      <div className="flex gap-3">
        <Icon size={18} className={cn("mt-0.5 shrink-0", iconColors[type])} />
        <div>
          {title && (
            <div className="mb-1 text-sm font-semibold text-text">
              {title}
            </div>
          )}
          <div className="text-sm leading-relaxed text-text-dim">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
