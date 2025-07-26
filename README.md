# shaman
Agent Manager

## Project Structure

This is a NodeJS/TypeScript monorepo that deliberately avoids npm workspaces in favor of a custom build system. The project uses `file:` protocol dependencies and a custom `./build.sh` script to manage the monorepo structure.

## Build System

Instead of npm workspaces (which we deliberately avoid), this project uses:
- `file:` protocol for local package dependencies
- Custom `./build.sh` script for building all packages
- Manual dependency management between packages

See `./agents/agent.md` for detailed development instructions.