# Environment Variable Management

This document is a design note for Zapper's environment variable model. It is
not an implementation reference yet.

## Goals

Zapper should make local development environment variables easy to share across
services without forcing users to copy the same values into many places.

The original model is still sound:

1. Load environment variables from a central source.
2. Treat that source as the local source of truth.
3. Decide what each service receives.

That matters for projects where many variables must line up across services. It
also matters for security-conscious teams that do not want secrets leaking into
unrelated services.

The problem is that explicit routing is too much ceremony for many local
projects. Zapper should support careful routing, but the common path should be
small enough that most projects can understand it at a glance.

## Recommended Model

Use one core model that scales across three user personas:

1. Global env file stack, plus `env: "*"` for services that can receive
   everything.
2. Service-level `env_files` when a service should use a different file stack.
3. External whitelist files for rare cases where teams need central storage and
   explicit variable routing.

This keeps `zap.yaml` focused on service composition. It avoids putting named
whitelist definitions into the core YAML spec, while still leaving an advanced
routing path for projects that need it.

The three personas are:

- The default local developer, who wants everything to run and does not want to
  think about env routing.
- The security-conscious power user, who wants direct control over which env
  files each service receives.
- The large-team platform owner, who has too many variables to duplicate across
  files and needs central storage plus explicit routing.

## Simple Default: Global Files and `*`

Most local projects should be able to define one global file stack and pass it
to each service:

```yaml
env_files: [.env.local, .env.user]

native:
  frontend:
    cmd: pnpm dev
    env: "*"

  backend:
    cmd: pnpm dev
    env: "*"
```

The convention is:

- `.env.local`: committed, non-sensitive local values.
- `.env.user`: gitignored, user-specific secrets and overrides.

The string value `*` is special. It means "pass the complete resolved
environment set to this service." It should not refer to a named whitelist.

This is intentionally visible. `env: "*"` reads as broad access, similar to a
permissive CORS setting, which makes the tradeoff obvious during review.

## Direct File Assignment

Some projects already think in service-specific env files. Zapper should support
that as a first-class escape hatch through service-level `env_files`:

```yaml
native:
  frontend:
    cmd: pnpm dev
    env_files: [.env.local, .env.user]
    env: "*"

  backend:
    cmd: pnpm dev
    env_files: [.env.local, .env.user]
    env: "*"
```

For a more segmented setup:

```yaml
native:
  frontend:
    cmd: pnpm dev
    env_files: [.env.common, .env.frontend, .env.user]
    env: "*"

  backend:
    cmd: pnpm dev
    env_files: [.env.common, .env.db, .env.backend, .env.user]
    env: "*"

  worker:
    cmd: pnpm worker
    env_files: [.env.common, .env.db, .env.worker, .env.user]
    env: "*"
```

This is powerful because users can build whatever file structure they want.
They can keep shared variables in `.env.common`, database variables in
`.env.db`, and service-specific values in `.env.backend` or `.env.worker`.

The tradeoff is that file routing is still routing. A broad `.env.user` may
contain secrets that not every service needs. If that matters, users need
narrower user files:

```yaml
native:
  frontend:
    cmd: pnpm dev
    env_files: [.env.common, .env.frontend, .env.frontend.user]
    env: "*"

  backend:
    cmd: pnpm dev
    env_files: [.env.common, .env.db, .env.backend, .env.backend.user]
    env: "*"
```

That is acceptable as an escape hatch. It closely matches how many env systems
already work, and it does not require Zapper to own every routing decision.

The important naming rule is:

- `env_files` says where values come from.
- `env` says which loaded values are exposed.

Do not overload `env` with file paths. Arrays under `env` should continue to
mean variable names and inline assignments, not files.

## Explicit Variable Routing

For security-conscious setups, services can still list the variables they
receive:

```yaml
env_files: [.env.common, .env.db, .env.backend, .env.user]

native:
  frontend:
    cmd: pnpm dev
    env:
      - VITE_API_URL
      - VITE_FEATURE_FLAGS

  backend:
    cmd: pnpm dev
    env:
      - DATABASE_URL
      - JWT_SECRET

  worker:
    cmd: pnpm worker
    env:
      - DATABASE_URL
      - QUEUE_SECRET
```

This keeps central storage while making access explicit. It is verbose, but
that verbosity is useful when the goal is preventing accidental exposure.

This model works well for large projects with hundreds or thousands of
variables. Copying values across service-specific files would be painful, but
listing which existing variables each service receives is manageable and
reviewable.

## External Whitelist Files

Named whitelists should move out of the core `zap.yaml` spec. They are an
advanced routing mechanism, not service composition.

Instead of this:

```yaml
whitelists:
  frontend:
    - VITE_API_URL
  backend:
    - DATABASE_URL
    - JWT_SECRET

native:
  frontend:
    cmd: pnpm dev
    env: frontend
```

Prefer an external routing file:

```yaml
env_files: [.env.common, .env.db, .env.user]
env_whitelists: .zap/env-whitelists.yaml

native:
  frontend:
    cmd: pnpm dev
    env: frontend

  backend:
    cmd: pnpm dev
    env: backend
```

With `.zap/env-whitelists.yaml`:

```yaml
frontend:
  - VITE_API_URL
  - VITE_FEATURE_FLAGS

backend:
  - DATABASE_URL
  - JWT_SECRET
```

This preserves the current useful behavior, but removes whitelist definitions
from the main config shape. It also gives large teams a place to put routing
policy without making every small `zap.yaml` carry that concept.

If a service has `env: some-name`, Zapper should resolve it as:

1. If the value is exactly `*`, pass all loaded variables.
2. Otherwise, treat the string as a whitelist name loaded from the external
   whitelist file.
3. If no whitelist file is configured, or the name does not exist, fail with a
   clear error.

Whitelist names should not use reserved values. In particular, `*` must be
invalid:

```text
Whitelist name "*" is reserved. Use env: "*" on a service to pass all variables,
or choose a different whitelist name.
```

## Persona Stress Test

The proposed model is useful only if it handles the common case without ceremony
and still has a credible answer for more demanding setups.

### Persona 1: Default Local Developer

This user has a few services and a manageable number of variables. Most values
are local-only coordination values: ports, local URLs, feature toggles, and
container credentials that are not meaningful outside the dev machine.

They want:

- One obvious place to put shared values.
- One gitignored place to put personal overrides.
- No per-service env bookkeeping.

They should use a global stack and `env: "*"`:

```yaml
env_files: [.env.local, .env.user]

native:
  frontend:
    cmd: pnpm dev
    env: "*"

  backend:
    cmd: pnpm dev
    env: "*"

docker:
  postgres:
    image: postgres:15
    env: "*"
```

This is intentionally permissive. It is the right default because local dev
often values alignment more than isolation. The star is still visible enough to
signal broad access.

How the model handles it:

- Strong fit.
- Small `zap.yaml`.
- No variable duplication.
- The user can later move one service to a narrower `env_files` stack without
  changing the rest of the project.

### Persona 2: Security-Conscious Power User

This user has enough secrets that they do not want every service receiving the
same gitignored user file. They also prefer ordinary env files over Zapper-owned
whitelist policy.

They want:

- Direct file assignment per service.
- Shared non-sensitive files where useful.
- Separate user secret files for sensitive services.
- No central whitelist registry in `zap.yaml`.

They should use service-level `env_files` and still use `env: "*"` within each
service's selected file stack:

```yaml
native:
  frontend:
    cmd: pnpm dev
    env_files: [.env.common, .env.frontend, .env.frontend.user]
    env: "*"

  backend:
    cmd: pnpm dev
    env_files: [.env.common, .env.db, .env.backend, .env.backend.user]
    env: "*"

  worker:
    cmd: pnpm worker
    env_files: [.env.common, .env.db, .env.worker, .env.worker.user]
    env: "*"
```

This gives the user control using files they already understand. It does not
centralize every variable, so shared subsets like database config may appear in
named files such as `.env.db`, but that is an acceptable tradeoff for this
persona.

How the model handles it:

- Strong fit.
- Security boundaries are represented by file boundaries.
- `zap.yaml` stays readable because it names file stacks rather than individual
  variables.
- The main weakness is that file composition becomes the routing system. If the
  project grows to hundreds or thousands of variables, this can become hard to
  maintain.

### Persona 3: Large-Team Platform Owner

This user has a large environment surface, possibly hundreds or thousands of
variables. Many values need to line up across services. Copying variables into
service-specific files would be risky and tedious.

They want:

- Central env files as the source of truth.
- Explicit routing so services receive only what they need.
- Reusable route names.
- Routing policy outside the core service config.

They should use global `env_files` plus an external whitelist file:

```yaml
env_files: [.env.company, .env.local, .env.user]
env_whitelists: .zap/env-whitelists.yaml

native:
  frontend:
    cmd: pnpm dev
    env: frontend

  backend:
    cmd: pnpm dev
    env: backend

  worker:
    cmd: pnpm worker
    env: worker
```

With `.zap/env-whitelists.yaml`:

```yaml
frontend:
  - VITE_API_URL
  - VITE_FEATURE_FLAGS

backend:
  - DATABASE_URL
  - REDIS_URL
  - JWT_SECRET

worker:
  - DATABASE_URL
  - REDIS_URL
  - QUEUE_SECRET
```

This is the most complex setup, but it earns that complexity. The environment
values remain centralized, while routing policy moves into a dedicated file
that can be reviewed separately from service definitions.

How the model handles it:

- Good fit for very large projects.
- Avoids copying values across service files.
- Keeps `zap.yaml` from being polluted by long whitelist definitions.
- The complexity is isolated to projects that actually need it.

## Why This Is the Middle Ground

This is technically three capabilities, but only one needs to be common:

- Common path: global `env_files`, `env: "*"` per service.
- Power-user path: service-level `env_files` for direct file assignment.
- Large-team path: external whitelist files for central storage plus explicit
  routing.

The benefit is that the capabilities compose without making `zap.yaml` feel like
it has three competing env systems.

The core ideas stay consistent:

- File stacks define available values.
- `env: "*"` exposes all loaded values.
- `env: [NAME, OTHER=value]` exposes explicit variables and inline values.
- `env: name` is advanced routing through an external whitelist file.

## Migration Direction

Keep existing inline `whitelists` support for compatibility, but mark it as
legacy once external whitelist files exist.

The likely migration path is:

1. Add `env: "*"` and reserve `*` as a whitelist name.
2. Normalize service-level `env_files` across native processes, Docker
   services, and tasks.
3. Add external whitelist files.
4. Deprecate inline `whitelists` in `zap.yaml`.

The desired end state is:

- Most projects use global `env_files` and `env: "*"`.
- Projects with existing env-file conventions use service-level `env_files`.
- Security-conscious projects use explicit arrays or external whitelist files.
- Inline `whitelists` disappear from the core YAML spec.
