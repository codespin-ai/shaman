/**
 * GraphQL custom scalar implementations
 */

import { GraphQLScalarType, Kind } from 'graphql';
import type { ValueNode, ObjectFieldNode } from 'graphql';
import { GraphQLError } from 'graphql';

/**
 * DateTime scalar - ISO 8601 formatted date-time strings
 */
export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 formatted date-time string with timezone',
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    throw new GraphQLError('DateTime must be a Date, string, or number');
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new GraphQLError('Invalid DateTime format');
      }
      return date;
    }
    throw new GraphQLError('DateTime must be a string or number');
  },
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) {
        throw new GraphQLError('Invalid DateTime format', { nodes: ast });
      }
      return date;
    }
    throw new GraphQLError('DateTime must be a string', { nodes: ast });
  },
});

/**
 * ToolCallID scalar - Unique identifier for tool calls (typically UUIDs)
 */
export const ToolCallIDScalar = new GraphQLScalarType({
  name: 'ToolCallID',
  description: 'Unique identifier for tool calls, typically UUIDs',
  serialize(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new GraphQLError('ToolCallID must be a string');
  },
  parseValue(value: unknown): string {
    if (typeof value === 'string') {
      // Basic UUID validation
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(value)) {
        throw new GraphQLError('ToolCallID must be a valid UUID');
      }
      return value;
    }
    throw new GraphQLError('ToolCallID must be a string');
  },
  parseLiteral(ast): string {
    if (ast.kind === Kind.STRING) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(ast.value)) {
        throw new GraphQLError('ToolCallID must be a valid UUID', { nodes: ast });
      }
      return ast.value;
    }
    throw new GraphQLError('ToolCallID must be a string', { nodes: ast });
  },
});

/**
 * JSON scalar - Arbitrary JSON data
 */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON data',
  serialize(value: unknown): unknown {
    return value;
  },
  parseValue(value: unknown): unknown {
    return value;
  },
  parseLiteral(ast): unknown {
    switch (ast.kind) {
      case Kind.STRING:
        return ast.value;
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.OBJECT:
        return ast.fields.reduce<Record<string, unknown>>((acc, field) => {
          acc[field.name.value] = parseLiteral(field.value);
          return acc;
        }, {});
      case Kind.LIST:
        return ast.values.map(parseLiteral);
      case Kind.NULL:
        return null;
      default:
        throw new GraphQLError(`Unexpected kind in JSON: ${ast.kind}`, { nodes: ast });
    }
  },
});

/**
 * EmailAddress scalar - Valid email address format
 */
export const EmailAddressScalar = new GraphQLScalarType({
  name: 'EmailAddress',
  description: 'Valid email address format',
  serialize(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new GraphQLError('EmailAddress must be a string');
  },
  parseValue(value: unknown): string {
    if (typeof value === 'string') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        throw new GraphQLError('Invalid email address format');
      }
      return value.toLowerCase();
    }
    throw new GraphQLError('EmailAddress must be a string');
  },
  parseLiteral(ast): string {
    if (ast.kind === Kind.STRING) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(ast.value)) {
        throw new GraphQLError('Invalid email address format', { nodes: ast });
      }
      return ast.value.toLowerCase();
    }
    throw new GraphQLError('EmailAddress must be a string', { nodes: ast });
  },
});

/**
 * Upload scalar - File upload handling (placeholder for now)
 */
export const UploadScalar = new GraphQLScalarType({
  name: 'Upload',
  description: 'File upload scalar',
  serialize: () => {
    throw new GraphQLError('Upload serialization not supported');
  },
  parseValue: (value: unknown) => {
    // In a real implementation, this would handle multipart form data
    // For now, we'll accept an object with file metadata
    if (typeof value === 'object' && value !== null) {
      return value;
    }
    throw new GraphQLError('Upload must be an object');
  },
  parseLiteral: () => {
    throw new GraphQLError('Upload literal parsing not supported');
  },
});

// Helper function for recursive literal parsing
function parseLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      return (ast as any).value;
    case Kind.BOOLEAN:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      return (ast as any).value;
    case Kind.INT:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      return parseInt((ast as any).value, 10);
    case Kind.FLOAT:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      return parseFloat((ast as any).value);
    case Kind.OBJECT:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return (ast as any).fields.reduce((acc: Record<string, unknown>, field: ObjectFieldNode) => {
        acc[field.name.value] = parseLiteral(field.value);
        return acc;
      }, {} as Record<string, unknown>);
    case Kind.LIST:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      return (ast as any).values.map(parseLiteral);
    case Kind.NULL:
      return null;
    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      throw new GraphQLError(`Unexpected kind in parseLiteral: ${(ast as any).kind}`);
  }
}