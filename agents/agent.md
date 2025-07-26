# Shaman Agent Development Guide (Revised)

Welcome, Agent. This is your primary operational guide. Adherence to these instructions is mandatory. Your goal is to write code that is consistent with the established patterns of this repository.

## 1. Core Principles

1.  **Read the Docs First**: Before any implementation, review the project documentation in the `/docs` directory. It contains the high-level architecture and concepts.
2.  **Observe Existing Patterns**: Before writing new code, inspect the package structure and existing files to understand the established conventions. Do not introduce new patterns without explicit instruction.
3.  **Functional Programming**: This project uses a functional, module-based approach. **You must not use classes.** Export functions from modules.

## 2. Environment Setup

-   **Environment Variables**: The project requires PostgreSQL connection variables. Create a `.env` file in the root directory or ensure these are exported in your shell. The `knexfile.mjs` and `pg-promise` configuration depend on them.
    -   `SHAMAN_DB_HOST`
    -   `SHAMAN_DB_PORT`
    -   `SHAMAN_DB_NAME`
    -   `SHAMAN_DB_USER`
    -   `SHAMAN_DB_PASSWORD`

## 3. Project Architecture & Conventions

### Monorepo Structure
The codebase is a NodeJS/TypeScript monorepo located under `/node/packages`. Each package has a single responsibility.

-   **`@shaman/types`**: Contains shared TypeScript interfaces. **Always start here.**
-   **`@shaman/persistence`**: Handles all database interactions.
-   **`@shaman/git-resolver`**: Manages Git-based agent discovery.
-   **`@shaman/server`**: The main server application (GraphQL API).
-   *(Review the full list in this directory for other packages)*

### Dependency Management
-   This is **not** an `npm` or `yarn` workspace.
-   Dependencies between local packages **must** be specified using the `file:` protocol in the package's `package.json`.
    -   Example: `"@shaman/types": "file:../shaman-types"`

### Build System
-   The project is built using the **`./build.sh`** script in the root directory.
-   This script iterates through a hardcoded list of packages, runs `npm install` in each to link `file:` dependencies, and then compiles the TypeScript source with `tsc`.
-   **If you add a new package, you MUST update `./build.sh` to include it in the build sequence.**

### Database and Persistence
-   **Database**: PostgreSQL.
-   **Migrations**: Managed by **Knex.js**.
    -   Migration files are located in `/database/migrations`.
    -   Use the root `npm run migrate:make` and `npm run migrate:latest` scripts.
-   **Data Access**: Handled by **`pg-promise`**.
    -   **Do not use an ORM**. All database access logic resides in `/node/packages/shaman-persistence`.

### Naming and Coding Conventions
1.  **TypeScript (`.ts` files)**: All variables, properties, and function names **must be `camelCase`**.
2.  **Database (SQL files)**: All table and column names **must be `snake_case`**.
3.  **Table Names**: All database table names **must be singular** (e.g., `agent_repository`, not `agent_repositories`).
4.  **File Paths**: Module imports/exports **must include the `.js` file extension** (e.g., `from './db.js'`).
5.  **Mapping**: The persistence layer (`shaman-persistence`) is solely responsible for mapping between TypeScript `camelCase` and database `snake_case`.

## 4. Standard Development Workflow

Follow these steps **in order**:

1.  **Define Types**: Add or update `camelCase` interfaces in `@shaman/types`.
2.  **Create/Update Package Dependencies**: If adding a new package, create its `package.json` and update the `package.json` of any package that depends on it using a `file:` reference.
3.  **Update Build Script**: If you added a new package, add it to the build sequence in `./build.sh`.
4.  **Create Migration**: Use `npm run migrate:make` to create a new migration file. Define the `snake_case`, singular-named tables and columns here.
5.  **Implement Persistence Functions**: In `@shaman/persistence`, create functional modules to interact with the new tables. Handle the `camelCase` to `snake_case` mapping within these functions.
6.  **Implement Business Logic**: In the appropriate package (e.g., `@shaman/git-resolver`), import functions from the persistence layer and implement the core feature logic.
7.  **Build**: Run `./build.sh` from the root directory to compile everything and verify there are no type errors.
8.  **Run Migration**: Run `npm run migrate:latest` to apply your schema changes to the database.
