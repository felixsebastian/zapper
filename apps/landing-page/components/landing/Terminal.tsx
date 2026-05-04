import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export const Terminal = ({
  title = "zsh",
  className,
  children,
}: TerminalProps) => {
  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border shadow-2xl",
        "bg-[hsl(var(--term-bg))] border-[hsl(var(--term-border))]",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(var(--term-border))] bg-[hsl(var(--term-bg))]">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[hsl(0_72%_55%)]" />
          <span className="h-3 w-3 rounded-full bg-[hsl(40_90%_55%)]" />
          <span className="h-3 w-3 rounded-full bg-[hsl(142_60%_50%)]" />
        </div>
        <span className="ml-2 text-xs font-mono-tight text-[hsl(var(--term-muted))]">
          {title}
        </span>
      </div>
      <pre className="font-mono-tight text-[13px] leading-relaxed p-5 overflow-x-auto text-[hsl(var(--term-fg))]">
        {children}
      </pre>
    </div>
  );
};

export const Prompt = ({ children }: { children: ReactNode }) => (
  <div>
    <span className="text-[hsl(var(--term-prompt))]">$ </span>
    <span className="text-[hsl(var(--term-fg))]">{children}</span>
  </div>
);

export const Out = ({
  children,
  color,
}: {
  children: ReactNode;
  color?: "muted" | "up" | "down" | "accent";
}) => {
  const cls =
    color === "muted"
      ? "text-[hsl(var(--term-muted))]"
      : color === "up"
        ? "text-[hsl(var(--term-up))]"
        : color === "down"
          ? "text-[hsl(var(--term-down))]"
          : color === "accent"
            ? "text-[hsl(var(--term-accent))]"
            : "text-[hsl(var(--term-fg))]";
  return <div className={cls}>{children}</div>;
};
