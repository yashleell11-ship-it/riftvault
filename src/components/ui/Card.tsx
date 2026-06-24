import { cn } from "@/lib/utils";

type CardProps = {
  children?: React.ReactNode;
  className?: string;
  shine?: boolean;
};

export function Card({ children, className, shine }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg-surface p-6",
        shine && "card-shine",
        className
      )}
    >
      {children}
    </div>
  );
}
