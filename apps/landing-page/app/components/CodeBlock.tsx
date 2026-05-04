"use client";

import React, { useState } from "react";
import { Highlight, themes, type RenderProps } from "prism-react-renderer";
import { Copy, Check } from "lucide-react";

interface Props {
  language: string;
  code: string;
}

export default function CodeBlock({ language, code }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition-colors">
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy code"
        className="absolute top-2 right-2 rounded-md bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border border-neutral-300 p-1.5 transition"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <Highlight
        theme={{
          ...themes.github,
          plain: { ...themes.github.plain, backgroundColor: "transparent" },
        }}
        code={code.trim()}
        language={language}
      >
        {({
          className,
          style,
          tokens,
          getLineProps,
          getTokenProps,
        }: RenderProps) => (
          <pre
            className={`${className} m-0 p-4 sm:p-5 text-sm leading-6 overflow-x-auto`}
            style={style}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
