---
trigger: always_on
---

# Database Rules

## PostgreSQL

- PostgreSQL is the primary database.
- Use the existing database architecture.
- Do not change database schema unless required by the task.

## Sequelize

- Use Sequelize ORM following existing project conventions.
- Reuse existing models and associations where possible.
- Do not create duplicate models for existing tables.

## Migrations

- Database schema changes must use migrations.
- Never manually modify the production database as part of normal development.
- Migrations must be reversible where practical.

## Transactions

Use transactions when multiple database operations must succeed or fail together.

Examples:
- Creating a certificate and its items.
- Generating sequential business numbers.
- Updating multiple related records.
- Approval workflows.

## Concurrency

- Consider race conditions for sequential numbers.
- Do not assume application-level checks alone prevent duplicate records.
- Use database constraints where appropriate.

## Performance

- Avoid unnecessary queries.
- Avoid N+1 query patterns.
- Use appropriate indexes.
- Select only required fields when appropriate.
- Analyze expensive queries before optimizing.