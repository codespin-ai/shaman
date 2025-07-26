# Shaman Agent Development Guide

Welcome, Agent. This guide provides a comprehensive overview for working on the Shaman codebase. Adhering to these guidelines is mandatory for all development tasks.

## 1. Initial Understanding: Read the Docs First

Before making any changes, you **must** familiarize yourself with the project's high-level architecture and concepts by reading the documentation located in the `/docs` directory.

Start with `docs/README.md` to get an overview and navigation guide for the rest of the documentation.

## 2. Project Structure: A NodeJS Monorepo

This is a NodeJS/TypeScript monorepo. The core application logic is divided into specialized packages located under `node/packages/`. You must place new logic in the appropriate package.

### Comprehensive Package List:

*   `shaman-cli`: The command-line interface for interacting with the Shaman system.
*   `shaman-config`: Manages and provides access to system-wide configuration.
*   `shaman-core`: Contains core business logic, primary services, and orchestration.
*   `shaman-external-registry`: Manages the registration and discovery of external A2A (Agent-to-Agent) agents.
*   `shaman-git-resolver`: **(Crucial for Git agents)** Handles all logic for finding, cloning, parsing, and resolving agents from Git repositories.
*   `shaman-llm-core`: Provides the core abstractions and interfaces for interacting with various Large Language Models (LLMs).
*   `shaman-llm-vercel`: A specific implementation for an LLM provider, likely for Vercel's AI SDK.
*   `shaman-observability`: Manages logging, tracing, and metrics (e.g., OpenTelemetry) for monitoring the system.
*   `shaman-persistence`: **(Crucial for database work)** Handles all database interactions. See Section 3 for details.
*   `shaman-security`: Manages authentication, authorization, and other security-related concerns.
*   `shaman-server`: The main application server package. It contains the GraphQL API layer and resolvers.
*   `shaman-tool-router`: Responsible for routing tool execution requests to the correct implementation.
*   `shaman-types`: **(Start here)** Contains all shared TypeScript type definitions and interfaces used across the monorepo.
*   `shaman-worker`: A generic worker process, likely used for running background jobs from a queue.
*   `shaman-workflow-bullmq`: An adapter that allows using BullMQ (a Redis-based queue) as the workflow engine.
*   `shaman-workflow-core`: Defines the core interfaces and types for all workflow engine adapters, ensuring pluggability.
*   `shaman-workflow-temporal`: An adapter that allows using Temporal as the workflow engine for durable, long-running tasks.

## 3. Database and Persistence Layer

This project uses a PostgreSQL database. **You must not use an ORM like Prisma.**

*   **Database Access**: All direct database access must be handled using the `pg-promise` library. The primary database connection is configured and exported from `node/packages/shaman-persistence/src/db.ts`.
*   **Migrations**: Database schema changes are managed by **Knex.js**.
    *   Migration files are located in `database/migrations/`.
    *   The configuration for Knex is in the root `knexfile.mjs`.
    *   Run migration scripts from the root directory (e.g., `npm run migrate:latest`).
*   **Naming Convention**: All database table names **must be singular** (e.g., `agent_repository`, `git_agent`).

## 4. Standard Development Workflow

Follow this sequence when adding a new data-driven feature:

1.  **Types**: Define or update the necessary TypeScript interfaces in the `shaman-types` package.
2.  **Migrations**: Create a new Knex migration in the root `database/migrations/` directory to define or alter your database tables.
3.  **Persistence**: Add data access logic (functions that execute raw SQL queries) to the `shaman-persistence` package.
4.  **Business Logic**: Implement the core feature logic in the most relevant package(s) (e.g., `shaman-git-resolver` for Git operations or `shaman-core` for orchestration).
5.  **API Exposure**: If necessary, expose the new feature via the GraphQL API by adding resolvers in the `shaman-server` package.

By following this guide, you will ensure your work is consistent with the project's architecture and conventions.