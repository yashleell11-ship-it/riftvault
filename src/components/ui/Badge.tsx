import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "accent" | "gold" | "danger";
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase",
        variant === "default" && "bg-bg-hover text-text-secondary border border-border",
        variant === "accent" && "bg-accent/10 text-accent border border-accent/20",
        variant === "gold" && "bg-gold/10 text-gold border border-gold/20",
        variant === "danger" && "bg-danger/10 text-danger border border-danger/20",
        className
      )}
    >
      {children}
    </span>
  );
}
