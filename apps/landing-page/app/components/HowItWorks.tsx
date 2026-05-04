const items = [
  {
    title: "Declare your stack",
    body: "Processes, containers, env vars, and tasks live in a single `zap.yaml`.",
  },
  {
    title: "Start everything predictably",
    body: "Run `zap up`. Dependencies start first. Logs keep running even if your terminal dies.",
  },
  {
    title: "Operate from your editor",
    body: "Use the VS Code/Cursor extension to start/stop services and tail logs.",
  },
];

export default function HowItWorks() {
  return (
    <section className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pb-24 sm:pb-28 md:pb-32 max-w-6xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
        How it works
      </h2>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {items.map(({ title, body }) => (
          <div
            key={title}
            className="rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition-colors p-8 sm:p-10 space-y-3"
          >
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="text-neutral-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
