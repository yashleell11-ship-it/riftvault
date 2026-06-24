import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "gold";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-bg-base hover:bg-accent-dim shadow-[0_0_24px_var(--accent-glow)]",
  secondary:
    "bg-bg-surface border border-border text-text-primary hover:bg-bg-hover hover:border-accent/30",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-bg-hover",
  gold: "bg-gold text-bg-base hover:brightness-110 shadow-[0_0_24px_rgba(240,168,48,0.25)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-8 text-base",
};

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
} & (
  | React.ButtonHTMLAttributes<HTMLButtonElement>
  | ({ href: string } & Omit<React.ComponentProps<typeof Link>, "className">)
);

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className
  );

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
