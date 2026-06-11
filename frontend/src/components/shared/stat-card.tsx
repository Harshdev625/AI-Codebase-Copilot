import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ title, value, subtitle, className }: StatCardProps): React.JSX.Element {
  return (
    <Card className={cn("overflow-hidden bg-card/60 backdrop-blur-xl border-border/40 hover:border-primary/20 hover:shadow-glow-sm hover:-translate-y-0.5 transition-all duration-300 group", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary/70 transition-colors">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        {subtitle ? <p className="mt-2 text-xs font-medium text-muted-foreground/80">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}
