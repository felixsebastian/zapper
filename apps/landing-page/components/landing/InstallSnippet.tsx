"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallSnippetProps {
  command: string;
  className?: string;
}

export const InstallSnippet = ({ command, className }: InstallSnippetProps) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={cn(
        "h-10 inline-flex items-center gap-3 pl-3 pr-1 rounded-md font-mono-tight text-sm border bg-[hsl(var(--term-bg))] text-[hsl(var(--term-fg))] border-[hsl(var(--term-border))]",
        className,
      )}
    >
      <span className="text-[hsl(var(--term-prompt))]">$</span>
      <span>{command}</span>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy install command"
        className="ml-1 h-8 w-8 inline-flex items-center justify-center rounded text-[hsl(var(--term-muted))] hover:text-[hsl(var(--term-fg))] hover:bg-white/5 transition-colors"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};
