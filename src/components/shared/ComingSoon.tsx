import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ComingSoonProps = {
  title: string;
  description: string;
  phase: string;
};

export function ComingSoon({ title, description, phase }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-surface border border-border mb-6">
        <Construction className="h-7 w-7 text-accent" />
      </div>
      <Badge variant="accent" className="mb-4">
        {phase}
      </Badge>
      <h1 className="font-display text-3xl font-bold mb-4">{title}</h1>
      <p className="text-text-secondary leading-relaxed mb-8">{description}</p>
      <Button href="/" variant="secondary">
        Back to home
      </Button>
    </div>
  );
}
