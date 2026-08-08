---
trigger: always_on
---

# Backend Standards

- Use NestJS and TypeScript.
- Follow the existing module architecture.
- Keep controllers thin.
- Keep business logic in services or appropriate domain layers.
- Use DTOs for request validation.
- Use Sequelize according to existing project conventions.
- Apply authorization at the API layer.
- Use proper HTTP status codes.
- Never expose internal errors to clients.
- Use structured error handling.
- Use transactions when operations require atomicity.
- Add tests for critical business logic.
- Do not introduce unnecessary architectural complexity.