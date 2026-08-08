---
trigger: always_on
---

# Project Architecture Rules

## Technology Stack

- Frontend: React vite with TypeScript.
- Backend: NestJS with TypeScript.
- Database: PostgreSQL.
- ORM: Sequelize.
- API style: REST APIs.

## Architecture

- Follow the existing project architecture.
- Reuse existing patterns before introducing new patterns.
- Keep frontend and backend responsibilities separated.
- Keep business logic out of controllers and UI components.
- Place business logic in appropriate backend services.
- Prefer reusable components over duplicated code.

## Code Changes

- Do not modify unrelated files.
- Do not rewrite working modules unnecessarily.
- Prefer minimal and maintainable changes.
- Before introducing a new dependency, check whether an existing dependency can solve the problem.
- Preserve existing API contracts unless the requirement explicitly requires a breaking change.

## Database

- Use Sequelize for database access.
- Use migrations for schema changes.
- Do not modify production database structure directly.
- Use transactions for operations that must be atomic.

## Quality

- Use TypeScript strict typing.
- Avoid `any` unless there is a justified reason.
- Handle errors explicitly.
- Add tests for important business logic.
- Run type checking, linting, and relevant tests after implementation.