# Vercel AI SDK Documentation

This directory contains the official documentation for the Vercel AI SDK.

## Files

- `llms.txt` - Complete documentation from https://ai-sdk.dev/llms.txt (fetched on 2025-08-08)
  - This follows the llms.txt standard for LLM-readable documentation

## Overview

The Vercel AI SDK is a TypeScript library for building AI-powered applications. It provides:

- Unified API for multiple LLM providers (OpenAI, Anthropic, Google, etc.)
- Streaming support for real-time responses
- Tool/function calling capabilities
- Structured output generation
- Embedding support for RAG applications
- React hooks and components for UI integration

## Key Changes in Latest Version

The AI SDK has undergone significant API changes. Key differences include:

1. **Message Format**: Changed from `ModelMessage` types to simpler message format
2. **Tool Calling**: Updated API for tool definitions and execution
3. **Streaming**: New streaming API with improved TypeScript support
4. **Token Usage**: Changed property names for token counting

## Integration with Shaman

The `shaman-llm-vercel` package provides the Vercel AI SDK implementation for Shaman's LLM provider interface. Due to API changes in the AI SDK, this package requires updates to maintain compatibility.

## Resources

- Official Documentation: https://ai-sdk.dev
- llms.txt URL: https://ai-sdk.dev/llms.txt
- GitHub: https://github.com/vercel/ai
- Migration Guide: https://ai-sdk.dev/docs/migration

## About llms.txt

The llms.txt format is a standard for providing LLM-readable documentation. It allows AI assistants to quickly access and understand API documentation, making it easier to provide accurate code suggestions and implementations.
