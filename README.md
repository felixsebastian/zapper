# Zapper CLI

A minimal TypeScript CLI project using ES modules, pnpm, and vitest.

## Prerequisites

- Node.js 18+ (use nvm: `nvm use`)
- pnpm: `npm install -g pnpm`

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## Run

```bash
pnpm start
```

## Local Installation

```bash
pnpm link --global
zap
```

## Usage

```bash
# After building
node dist/index.js

# With arguments
node dist/index.js arg1 arg2

# After npm install -g zapper-cli
zap
``` 