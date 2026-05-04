const before = [
  "8 terminal tabs to babysit",
  "Startup order you forget every time",
  "Random scripts + docker-compose sprawl",
  "Secrets leaking into the wrong process",
];

const after = [
  "One `zap.yaml` checked into git",
  "`zap up` starts everything (in order)",
  "`zap logs` when you need it, not forever",
  "Env vars whitelisted per service",
];

export default function BeforeAfter() {
  return (
    <section className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pb-24 sm:pb-28 md:pb-32 max-w-5xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
        What you stop doing
      </h2>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 sm:p-10">
          <div className="text-sm font-medium text-neutral-500">Before</div>
          <ul className="mt-4 space-y-2 text-neutral-700">
            {before.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-8 sm:p-10">
          <div className="text-sm font-medium text-neutral-500">After</div>
          <ul className="mt-4 space-y-2 text-neutral-700">
            {after.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
