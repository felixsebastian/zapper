import Link from "next/link";

interface Props {
  title: string;
  subtitle: string;
}

export default function Hero({ title, subtitle }: Props) {
  return (
    <section className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 py-24 sm:py-28 md:py-32 flex flex-col items-center text-center gap-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-700">
        Dev stack as code
      </div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-2xl">
        {subtitle}
      </p>
      <div className="flex flex-wrap justify-center items-center gap-3 mt-2">
        <Link
          href="https://github.com/felixsebastian/zapper/blob/main/docs/usage.md"
          className="rounded-xl bg-neutral-50 text-neutral-900 px-4 py-2 text-sm sm:text-base hover:bg-neutral-100 transition-colors"
        >
          📚 Docs
        </Link>
        <Link
          href="https://github.com/felixsebastian/zapper"
          className="rounded-xl bg-neutral-50 text-neutral-900 px-4 py-2 text-sm sm:text-base hover:bg-neutral-100 transition-colors"
        >
          🐙 GitHub
        </Link>
        <Link
          href="https://marketplace.visualstudio.com/items?itemName=felixsebastian.zapper-vscode"
          className="rounded-xl bg-neutral-50 text-neutral-900 px-4 py-2 text-sm sm:text-base hover:bg-neutral-100 transition-colors"
        >
          🧩 Extension
        </Link>
        <Link
          href="https://discord.gg/2zdyJMce"
          className="rounded-xl bg-neutral-50 text-neutral-900 px-4 py-2 text-sm sm:text-base hover:bg-neutral-100 transition-colors"
        >
          👾 Discord
        </Link>
      </div>
    </section>
  );
}
