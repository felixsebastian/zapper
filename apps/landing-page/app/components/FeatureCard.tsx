import React from "react";

interface Props {
  title: string;
  subtitle: string;
}

export default function FeatureCard({ title, subtitle }: Props) {
  return (
    <div className="rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition-colors p-8 sm:p-10 space-y-4">
      <h3 className="text-xl sm:text-2xl font-semibold">{title}</h3>
      <p className="mt-1 text-neutral-600">{subtitle}</p>
    </div>
  );
}
