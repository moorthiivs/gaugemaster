---
trigger: always_on
---

# Security Rules

## Authentication

- Never bypass authentication requirements.
- Never trust authentication state from the frontend alone.
- Validate authenticated user identity on the backend.

## Authorization

- Enforce authorization on backend APIs.
- Never rely only on frontend role checks.
- Verify tenant and organization ownership before accessing protected resources.

## Input Validation

- Validate all external input.
- Validate request bodies, query parameters, route parameters, and uploaded files.
- Never trust client-provided IDs or permissions.

## Secrets

- Never hardcode passwords, API keys, tokens, database credentials, or private keys.
- Never commit secrets to Git.
- Use environment variables or the project's existing secret-management approach.

## Database Security

- Use parameterized queries or ORM-safe query methods.
- Never construct unsafe SQL using raw user input.
- Do not expose internal database errors directly to API consumers.

## Logging

- Never log passwords.
- Never log access tokens.
- Never log API keys.
- Avoid logging sensitive customer information.

## File Uploads

- Validate file type.
- Validate file size.
- Do not trust the filename or MIME type alone.
- Prevent path traversal.
- Store uploaded files outside executable application directories where appropriate.