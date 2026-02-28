import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <Card className={cn("border-border/70 bg-card/80 shadow-sm", className)}>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
