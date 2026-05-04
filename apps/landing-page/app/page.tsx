import CodeBlock from "./components/CodeBlock";
import FeatureCard from "./components/FeatureCard";
import BeforeAfter from "./components/BeforeAfter";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Image from "next/image";

export default function Home() {
  return (
    <main className="font-sans min-h-screen bg-white text-neutral-900">
      <Hero
        title="Spin up. Code on. Zap zap."
        subtitle="Define processes, containers, env vars, and one-off tasks in one zap.yaml. Start it all with `zap up`."
      />

      <section className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pb-24 sm:pb-28 md:pb-32 max-w-7xl mx-auto">
        <div className="grid gap-16 sm:gap-20 md:gap-24">
          {/* Row 1: text left, code right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="grid gap-2">
              <h2 className="text-xl font-medium">1. Install</h2>
              <p className="text-neutral-600">
                Install the CLI (built on <b>PM2</b> + <b>Docker</b>).
              </p>
            </div>
            <div className="md:order-2">
              <CodeBlock
                language="bash"
                code={`npm install --global pm2 @mp-lb/zapper`}
              />
            </div>
          </div>

          {/* Row 2: code left, text right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="grid gap-2">
              <h2 className="text-xl font-medium">2. Configure</h2>
              <p className="text-neutral-600">
                Check in a single <b>zap.yaml</b> for your whole stack.
              </p>
            </div>
            <div className="md:order-2">
              <CodeBlock
                language="yaml"
                code={`project: myapp
env_files: [.env.base, .env]
native:
  frontend:
    repo: myorg/myapp-frontend
    cmd: pnpm dev
    cwd: ./frontend
    env: [API_KEY]
  backend:
    repo: myorg/myapp-backend
    cmd: python main.py
    cwd: ./backend
    env: [API_KEY, DB_PASS]
    depends_on: [database]
docker:
  database:
    image: postgres:15
    ports: [5432:5432]
    env: [POSTGRES_PASSWORD]
tasks:
  sync:
    cmds:
      - cd frontend; pnpm install
      - cd backend; poetry install
      - cd backend; poetry run alembic upgrade head`}
              />
            </div>
          </div>

          {/* Row 3: text left, code right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div className="grid gap-2">
              <h2 className="text-xl font-medium">3. Run</h2>
              <p className="text-neutral-600">
                Start everything (or just one service), then tail logs when you
                need them.
              </p>
            </div>
            <div className="md:order-2">
              <CodeBlock
                language="bash"
                code={`zap clone                  # clone all repos
zap task sync              # run tasks
zap up                     # start everything
zap down                   # stop everything
zap restart                # restart all
zap status                 # check what's running
zap up --service frontend  # start specific service
zap logs --service backend # view logs for a service`}
              />
            </div>
          </div>
        </div>
      </section>

      <BeforeAfter />

      <HowItWorks />

      <section className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pb-24 sm:pb-28 md:pb-32 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Extension for VS Code & Cursor
            </h2>
            <p className="text-lg text-neutral-600">
              Manage your Zapper projects directly from your IDE. Start, stop,
              and monitor your services with a beautiful interface that
              integrates seamlessly with your development workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://marketplace.visualstudio.com/items?itemName=felixsebastian.zapper-vscode"
                className="inline-flex items-center justify-center rounded-xl bg-neutral-50 text-neutral-900 px-6 py-3 text-sm sm:text-base hover:bg-neutral-100 transition-colors"
              >
                Install extension
              </a>
            </div>
          </div>
          <div className="relative">
            <Image
              src="/extension.jpg"
              alt="Zapper VS Code Extension Interface"
              width={1600}
              height={1000}
              className="rounded-xl shadow-2xl w-full h-auto"
            />
          </div>
        </div>
      </section>

      <section className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pb-24 sm:pb-28 md:pb-32 max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Features
        </h2>
        <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <FeatureCard
            title="One file, entire stack 🗂️"
            subtitle="Declare processes, containers, env files, and tasks in a single `zap.yaml`."
          />
          <FeatureCard
            title="Zero mental overhead 🧠"
            subtitle="Come back months later: `zap up` and you're running. No remembering ports or order."
          />
          <FeatureCard
            title="Detached logs 🧾"
            subtitle="Built on PM2 so logs persist even if your terminal/editor crashes."
          />
          <FeatureCard
            title="Secure by default 🔐"
            subtitle="Whitelist which env vars each service can see. Secrets stay out of services that don't need them. No more accidental leakage."
          />
          <FeatureCard
            title="Dependencies 🔗"
            subtitle="Start services in the right order with `depends_on`. Works great for multi-repo stacks."
          />
          <FeatureCard
            title="Tasks 🧰"
            subtitle="Define one-off commands with parameters and pass-through args: `zap task seed`."
          />
        </div>
      </section>

      <footer className="px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 2xl:px-24 pb-8 max-w-7xl mx-auto">
        <p className="mx-auto text-sm text-neutral-600">
          Created by <a href="https://felixsebastian.dev">felixsebastian</a>.
        </p>
      </footer>
    </main>
  );
}
