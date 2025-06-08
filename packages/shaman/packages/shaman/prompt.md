I want to create an AI Agent co-ordination frameowrk called shaman - using a GQL API.
There are two projects. <root>/packages/shaman (the backend) and <root>/packages/ui

We're only interested in the backend now.

The server will be run as:
- node dist/index.js [--port <port>] [--config <config>]

The idea is this:
- MCP servers are specified the config file. Use "mcpServers" prop
- HTTP MCP servers can also be added via API.
- Agents can be added via API
- When defining an agent (prompt), you can specify which mcp servers you want to use
- And optionally specify tools (by default all tools)
- Tools can be added via API.
- Optionally specify model etc
- When defining an agent, also specify additional agents it might want to use
- When a new agent is called, it can receive all existing context, or a specific context.
  This is decided by the caller. If not specified by the caller, take the agent's defaults (should be in agent config).
  If nothing is specified anywhere, pass full context.
- This will form a DAG of agents working together
- This server (shaman) itself will need to expose the run_agent(s) tool - which works with the agent registry above.
  This will allow an agent to call another agent. Should allow parallel agent calling.
- We need APIs to list agents, tools, monitor running agents
- We need a database api which agents can use to save data
- Every root agent run is a new instance of a "workflow". This will however have the ability to fetch data which was previously saved
- Every agent needs some data save and read capability. It should save data namespaced under agent name (plus the "run id" or whatever we wanna call it - find good standard names for everything). 
- But agents can also read data stored by other agents and other runs. For example, if a run collected some data from a doc, a further analysis run should be able to use this data (via doc id or whatever.)
- All model communication should use vercel's AI module

Use yargs to read cli options. Strictly typed. 

The database tables need to be singular. Create a .env file to 

The API needs to be GraphQL. 

Each API needs to be handled by a different ts file/module.

Use modern TypeScript. All ESM. Imports need to have extensions.
Very strictly typed. Do not use any classes, fully functional style.
I want `function someName() {}` instead of `const someName = function() { .... }`

We'll use knex for the db migrations. (Again, esm style js in knex. No CJS anywhere).
Knex files should be under 

Use these libs:
- pg-promise

