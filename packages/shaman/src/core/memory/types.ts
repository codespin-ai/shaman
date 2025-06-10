// TODO: Define Memory Management Types
// Exported types:
// - type Memory = { id: string; key: string; value: unknown; agentName: string; runId: string; ... }
// - type MemoryKey = string
// - type MemoryValue = unknown
// - type MemoryMetadata = { createdAt: Date; expiresAt?: Date; size: number; ... }
// - type MemoryAccessPolicy = { read: boolean; write: boolean; delete: boolean; ... }
// - type MemoryAnalytics = { accessCount: number; lastAccessed: Date; ... }
// - type MemoryFilter = { agentName?: string; runId?: string; key?: string; ... }
// - type MemoryListOptions = { limit: number; offset: number; sortBy: 'createdAt' | 'key'; ... }
//
// Exported validation functions:
// - validateMemoryKey(key: string): boolean
// - validateMemoryValue(value: unknown): boolean
// - validateAgentNamespace(agentName: string): boolean
//
// Type definitions for memory storage with validation functions
