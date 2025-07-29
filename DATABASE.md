# Database Configuration

## Multi-Database Support

Shaman supports multiple databases through a flexible configuration system.

### Structure

```
/
├── knexfile.js             # Base configuration (shared by all databases)
├── scripts/
│   └── db-all.sh          # Script to run commands on all databases
└── database/
    ├── shaman/            # Shaman database
    │   ├── knexfile.js    # Database-specific config (imports from root)
    │   ├── migrations/    # Migrations for this database
    │   └── seeds/        # Seeds for this database
    └── [other-db]/       # Additional databases
        ├── knexfile.js
        ├── migrations/
        └── seeds/
```

### Usage

There is no default database. All database operations must be explicit:

```bash
# Shaman database operations
npm run migrate:shaman:latest
npm run migrate:shaman:rollback
npm run migrate:shaman:status
npm run migrate:shaman:make migration_name
npm run seed:shaman:make seed_name
npm run seed:shaman:run

# Run operations on ALL databases
npm run migrate:all         # Run latest migrations on all databases
npm run migrate:all:rollback
npm run migrate:all:status
npm run seed:all           # Run seeds on all databases
```

### Environment Variables

Each database must have its own connection settings with no shared defaults:

```bash
# Shaman database
export SHAMAN_DB_HOST=localhost
export SHAMAN_DB_PORT=5432
export SHAMAN_DB_NAME=shaman
export SHAMAN_DB_USER=postgres
export SHAMAN_DB_PASSWORD=postgres

# Analytics database (example)
export ANALYTICS_DB_HOST=analytics-server
export ANALYTICS_DB_PORT=5432
export ANALYTICS_DB_NAME=analytics_prod
export ANALYTICS_DB_USER=analytics_user
export ANALYTICS_DB_PASSWORD=analytics_pass
```

If environment variables are not set, the following defaults are used:
- Host: `localhost`
- Port: `5432`
- Database: lowercase database name (e.g., `shaman`, `analytics`)
- User: `postgres`
- Password: `postgres`

### Adding a New Database

1. Create a new directory under `database/`:
   ```bash
   mkdir -p database/mydb/migrations database/mydb/seeds
   ```

2. Create a knexfile.js for the database:
   ```javascript
   // database/mydb/knexfile.js
   import { createDbConfig } from '../../knexfile.js';

   export default createDbConfig('mydb', {
     // Any database-specific overrides
   });
   ```

3. Add scripts to package.json:
   ```json
   "migrate:mydb:make": "knex migrate:make --knexfile database/mydb/knexfile.js",
   "migrate:mydb:latest": "knex migrate:latest --knexfile database/mydb/knexfile.js",
   "migrate:mydb:rollback": "knex migrate:rollback --knexfile database/mydb/knexfile.js",
   "migrate:mydb:status": "knex migrate:status --knexfile database/mydb/knexfile.js",
   "seed:mydb:make": "knex seed:make --knexfile database/mydb/knexfile.js",
   "seed:mydb:run": "knex seed:run --knexfile database/mydb/knexfile.js"
   ```

4. Run migrations for the new database:
   ```bash
   npm run migrate:mydb:latest
   ```

### Script Naming Convention

All database-specific scripts follow this pattern:
- `migrate:[dbname]:make` - Create a new migration
- `migrate:[dbname]:latest` - Run pending migrations
- `migrate:[dbname]:rollback` - Rollback last migration
- `migrate:[dbname]:status` - Check migration status
- `seed:[dbname]:make` - Create a new seed file
- `seed:[dbname]:run` - Run seed files

The `:all` scripts operate on all databases:
- `migrate:all` - Run latest migrations on all databases
- `migrate:all:rollback` - Rollback all databases
- `migrate:all:status` - Check status of all databases