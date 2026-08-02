<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

NestJS API for **Expentra** — internal expense management (PostgreSQL, Redis, JWT, BullMQ worker).

Run all commands from this directory. The React frontend lives in the sibling [`../expentra-web`](../expentra-web) project.

### Documentation

| Doc | Audience |
|-----|----------|
| **[Architecture documentation](./docs/architecture/README.md)** | System design, domains, API surface, security, async, data, ops |
| [VPS deploy guide](./docs/vps-deploy-guide.md) | Staging/production infrastructure runbook |

OpenAPI/Swagger can be enabled at runtime (`SWAGGER_ENABLED`); optional Postman generation via `pnpm generate:postman`.

## Project setup

```bash
pnpm install
```

## Compile and run the project

The HTTP API and BullMQ worker are **separate processes** (same codebase and Docker image).

```bash
# API — development (watch)
$ pnpm run start:dev

# Worker — development (watch); required for background jobs
$ pnpm run start:worker:dev

# API — production build output
$ pnpm run start

# Worker — production build output
$ pnpm run start:worker
```

### Docker Compose (production-parity local)

Requires [`.env.development`](.env.development) (start from [`.env.example`](.env.example)). **All secrets** (`POSTGRES_PASSWORD`, `JWT_SECRET`, etc.) are loaded from that file via Compose `env_file` — nothing secret is hardcoded in `docker-compose.yml`. Compose only overrides connection topology (`POSTGRES_HOST=postgres`, `REDIS_URL=redis://redis:6379`, `POSTGRES_SSL=false`).

```bash
# Build runtime image and start postgres, redis, api, worker
# (also prunes dangling images left by the rebuild)
$ pnpm compose:up

# Follow api/worker logs
$ pnpm compose:logs

# Stop stack (volumes kept)
$ pnpm compose:down

# Extra cleanup: dangling images + unused build cache
$ pnpm compose:prune
```

Service ports and host URLs come from your env / compose config (see `.env.example` and `docker-compose.yml`).

The **api** container runs migrations on startup (`RUN_MIGRATIONS=true` via the Docker entrypoint). The **worker** does not (`RUN_MIGRATIONS=false`).

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `feature/*` | Feature work |
| `staging` | Integration / staging |
| `main` | Production |

Merge path: feature branch → `staging` (PR) → `main` (PR) when promoting to production.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
