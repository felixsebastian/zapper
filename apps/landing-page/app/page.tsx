import { InstallSnippet } from "@/components/landing/InstallSnippet";
import { Out, Prompt, Terminal } from "@/components/landing/Terminal";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const navLinks = [
  {
    label: "Docs",
    href: "https://github.com/felixsebastian/zapper/blob/main/docs/usage.md",
  },
  { label: "GitHub", href: "https://github.com/felixsebastian/zapper" },
  {
    label: "VS Code",
    href: "https://marketplace.visualstudio.com/items?itemName=felixsebastian.zapper-vscode",
  },
  { label: "Discord", href: "https://discord.gg/2zdyJMce" },
];

const features = [
  {
    title: "One command, whole stack",
    body: "zap up boots native processes and Docker containers together, in dependency order. zap down stops everything cleanly.",
  },
  {
    title: "Automatic port management",
    body: "Every stack instance gets unique random ports. Run the same project from three git worktrees, no clashes, no env juggling.",
  },
  {
    title: "Native + Docker, same config",
    body: "Declare PM2-managed processes and Docker services in one zap.yaml. Mix and match without writing two systems.",
  },
  {
    title: "Status at a glance",
    body: "zap ps shows what's up, what's down, and what ports are bound the moment you cd into a project.",
  },
  {
    title: "Tasks, profiles, environments",
    body: "Define tasks like seed or build, switch between profiles, swap env file sets, all from the CLI.",
  },
  {
    title: "Instances",
    body: "Spin up named instances of the same stack side by side for testing, demos, or e2e runs.",
  },
  {
    title: "Logs that survive crashes",
    body: "PM2-backed under the hood, so logs keep flowing even if your terminal or editor dies. zap logs api when you need them.",
  },
  {
    title: "Env vars, whitelisted per service",
    body: "Each service only sees the env vars it declares. Secrets stay out of processes that don't need them.",
  },
];

const commands = [
  ["zap up", "Start everything (or a subset, with deps)"],
  ["zap down", "Stop everything"],
  ["zap ps", "Status of every service"],
  ["zap ls", "Status + assigned ports"],
  ["zap logs api", "Tail logs for a service"],
  ["zap restart api worker", "Restart specific services"],
  ["zap task seed", "Run a defined task"],
  ["zap kill", "Nuke everything for this project"],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono-tight font-semibold"
          >
            <span className="text-accent">▲</span>
            <span>zap</span>
            <span className="font-normal text-muted-foreground">/ zapper</span>
          </Link>
          <nav className="hidden items-center gap-6 font-mono-tight text-sm text-muted-foreground sm:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="container relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono-tight text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                zapper
              </div>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight lg:text-5xl xl:text-6xl">
                The process manager
                <br />
                for <span className="text-accent">agents</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Declarative, stateful, isolated per worktree. One agent spins
                the stack up, another checks status. No PIDs, no long-lived
                terminals, no port clashes. Native processes and Docker
                containers, one yaml, one CLI.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <InstallSnippet command="npm i -g pm2 @mp-lb/zapper" />
                <Button
                  asChild
                  variant="outline"
                  className="h-10 font-mono-tight"
                >
                  <a
                    href="https://github.com/felixsebastian/zapper/blob/main/docs/usage.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the docs →
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 font-mono-tight"
                >
                  <a
                    href="https://github.com/felixsebastian/zapper"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </Button>
              </div>
            </div>

            <Terminal title="todo-app - zsh">
              <Prompt>zap up</Prompt>
              <Out color="accent">Starting mongodb, redis</Out>
              <Out color="accent">Starting backend, worker</Out>
              <Out color="accent">Starting frontend</Out>
              {"\n"}
              <Prompt>zap ls</Prompt>
              <Out color="muted">== Services (todo-app · 0xbabc) ==</Out>
              {"\n"}
              <Out color="muted">TYPE SERVICE STATUS CMD</Out>
              <Out>
                native backend{" "}
                <span className="text-[hsl(var(--term-up))]">UP</span> pnpm dev
              </Out>
              <Out>
                native worker{" "}
                <span className="text-[hsl(var(--term-up))]">UP</span> pnpm
                worker
              </Out>
              <Out>
                native frontend{" "}
                <span className="text-[hsl(var(--term-up))]">UP</span> pnpm dev
              </Out>
              <Out>
                docker mongodb{" "}
                <span className="text-[hsl(var(--term-up))]">UP</span>{" "}
                mongo:latest
              </Out>
              <Out>
                docker redis{" "}
                <span className="text-[hsl(var(--term-up))]">UP</span>{" "}
                redis:7-alpine
              </Out>
              {"\n"}
              <Prompt>zap links</Prompt>
              <Out color="muted">NAME URL</Out>
              <Out>
                Frontend{" "}
                <span className="text-[hsl(var(--term-path))]">
                  http://localhost:61964
                </span>
              </Out>
              <Out>
                API{" "}
                <span className="text-[hsl(var(--term-path))]">
                  http://localhost:50230
                </span>
              </Out>
              <Out>
                Worker queue{" "}
                <span className="text-[hsl(var(--term-path))]">
                  http://localhost:50231/queues
                </span>
              </Out>
              <Out>
                Maildev{" "}
                <span className="text-[hsl(var(--term-path))]">
                  http://localhost:63050
                </span>
              </Out>
              {"\n"}
              <Prompt>zap open</Prompt>
              <Out color="muted">→ opening http://localhost:61964</Out>
            </Terminal>
          </div>
        </section>

        <section className="border-b border-border bg-card">
          <div className="container py-20">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 font-mono-tight text-xs text-accent">
                BUILT FOR AGENTS
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Why &quot;for agents&quot;?
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Most process managers assume one human, one terminal, in the
                foreground. Agents work differently: they spawn, query, and
                exit. Zapper&apos;s architecture happens to fit that exactly.
                The same properties make life easier for humans coordinating
                with agents or with each other.
              </p>
            </div>

            <div className="grid overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {[
                [
                  "01 · STATEFUL",
                  "The truth lives on disk",
                  "zap ps and zap ls return the real state of the stack, not whatever your last terminal session remembered. Any agent, any shell, any time.",
                ],
                [
                  "02 · DETACHED",
                  "No long-lived terminals",
                  "PM2-backed processes keep running after the agent that started them exits. Another agent can zap logs api later. No PIDs to pass around, no babysitting.",
                ],
                [
                  "03 · ISOLATED",
                  "One stack per worktree",
                  "Run N agents on N worktrees of the same repo. Each gets its own ports, volumes, and state. Parallel work without coordination overhead.",
                ],
              ].map(([eyebrow, title, body]) => (
                <div key={title} className="bg-card p-6">
                  <div className="mb-3 font-mono-tight text-xs text-accent">
                    {eyebrow}
                  </div>
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid items-center gap-6 lg:grid-cols-[1fr_auto]">
              <p className="font-mono-tight text-sm text-muted-foreground">
                Bonus: nearly every command takes{" "}
                <code className="text-foreground">--json</code>. Pipe it
                straight into the next agent step.
              </p>
              <div className="flex w-fit items-center gap-3 rounded-md border border-[hsl(var(--term-border))] bg-[hsl(var(--term-bg))] px-4 py-2.5 font-mono-tight text-xs text-[hsl(var(--term-fg))]">
                <span className="text-[hsl(var(--term-prompt))]">$</span>
                <span>zap ls --json | jq &apos;.services&apos;</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="container py-20">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Also a really good process manager
              </h2>
              <p className="mt-3 text-muted-foreground">
                The agent story is the why. The day-to-day is just: a small CLI
                built on <span className="text-foreground">PM2</span> and the{" "}
                <span className="text-foreground">Docker CLI</span>, plus a
                single yaml that replaces the half-dozen scripts you usually
                keep in{" "}
                <code className="font-mono-tight text-foreground">
                  package.json
                </code>{" "}
                and your shell history.
              </p>
            </div>
            <div className="grid overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.title} className="bg-card p-6">
                  <div className="mb-3 font-mono-tight text-xs text-accent">
                    →
                  </div>
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="container grid items-center gap-12 py-20 lg:grid-cols-2">
            <div>
              <p className="mb-3 font-mono-tight text-xs text-accent">
                HOW THE ISOLATION WORKS
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Run the same project
                <br />
                three times. No clashes.
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Two checkouts of the same repo on disk? They&apos;re already
                isolated. Each one gets its own ports, volumes, and state in{" "}
                <code className="font-mono-tight text-foreground">
                  .zap/state.json
                </code>
                . Spin up four parallel agents on four branches; nobody fights
                over{" "}
                <code className="font-mono-tight text-foreground">:3000</code>.
                Nothing to configure.
              </p>
            </div>
            <Terminal title="zap.yaml">
              <Out color="muted">project: todo-app</Out>
              <Out color="muted">
                homepage: http://localhost:${"{"}FRONTEND_PORT{"}"}
              </Out>
              <Out color="muted">env:</Out>
              <Out> default: [.env.base, .env]</Out>
              <Out color="muted">ports:</Out>
              <Out> - BACKEND_PORT</Out>
              <Out> - FRONTEND_PORT</Out>
              <Out> - MONGODB_PORT</Out>
              <Out> - REDIS_PORT</Out>
              {"\n"}
              <Out color="muted">native:</Out>
              <Out> backend:</Out>
              <Out> cmd: pnpm dev</Out>
              <Out> cwd: ./api</Out>
              <Out> depends_on: [mongodb, redis]</Out>
              <Out>
                healthcheck: http://localhost:${"{"}BACKEND_PORT{"}"}/health
              </Out>
              {"\n"}
              <Out color="muted">docker:</Out>
              <Out> mongodb:</Out>
              <Out> image: mongo:7</Out>
              <Out>
                ports: [${"{"}MONGODB_PORT{"}"}:27017]
              </Out>
              <Out> redis:</Out>
              <Out> image: redis:7-alpine</Out>
              <Out>
                ports: [${"{"}REDIS_PORT{"}"}:6379]
              </Out>
            </Terminal>
          </div>
        </section>

        <section className="border-b border-border" id="docs">
          <div className="container py-20">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                The commands you&apos;ll actually use
              </h2>
              <p className="mt-3 text-muted-foreground">
                The full CLI is bigger than this, but most days it&apos;s just
                these.
              </p>
            </div>
            <div className="grid overflow-hidden rounded-lg border border-border bg-border font-mono-tight text-sm md:grid-cols-2">
              {commands.map(([cmd, desc]) => (
                <div key={cmd} className="flex flex-col gap-1 bg-card p-5">
                  <code className="text-accent">{cmd}</code>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border" id="vscode">
          <div className="container max-w-3xl py-20">
            <p className="mb-3 font-mono-tight text-xs text-accent">
              EXTENSION
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              There&apos;s a VS Code extension too.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              See statuses, start and stop services, and run tasks from the
              sidebar. Install{" "}
              <code className="font-mono-tight text-foreground">
                felixsebastian.zapper-vscode
              </code>
              . If you live in your terminal or an AI coding tool, you probably
              won&apos;t need it, but it&apos;s there.
            </p>
          </div>
        </section>

        <section>
          <div className="container py-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              Give your agents a stack they can drive.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              One yaml. One CLI. Stateful, detached, isolated. Works just as
              well when the only agent at the keyboard is you.
            </p>
            <div className="mt-8 flex justify-center">
              <InstallSnippet command="npm install -g pm2 @mp-lb/zapper" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-8 font-mono-tight text-xs text-muted-foreground">
          <span>
            built by{" "}
            <a
              href="https://www.mp-lb.dev"
              target="_blank"
              rel="noreferrer"
              className="text-foreground transition-colors hover:text-accent"
            >
              MAP Lab
            </a>
          </span>
          <div className="flex items-center gap-5">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
