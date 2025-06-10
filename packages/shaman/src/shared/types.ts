// TODO: Define Shared TypeScript Types
// Exported types:
// - type ExecutionState = 'SUBMITTED' | 'WORKING' | 'INPUT_REQUIRED' | 'COMPLETED' | 'FAILED' | ...
// - type AgentSource = 'GIT' | 'A2A_EXTERNAL'
// - type CompletionStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED'
// - type ContextScope = 'FULL' | 'NONE' | 'SPECIFIC'
//
// - type User = { id: string; email: string; name: string; role: UserRole; ... }
// - type GitAgent = { name: string; description: string; version: string; ... }
// - type ExternalAgent = { id: string; name: string; endpoint: string; ... }
// - type Run = { id: string; status: ExecutionState; steps: Step[]; ... }
// - type Step = { id: string; agentName: string; status: ExecutionState; ... }
//
// - type Message = { id: string; role: MessageRole; content: string; ... }
// - type ToolCall = { id: string; name: string; arguments: unknown; ... }
// - type AgentCompletion = { result: string; status: CompletionStatus; ... }
//
// - type Configuration = { port: number; database: DatabaseConfig; ... }
// - type ValidationResult = { valid: boolean; errors: ValidationError[]; }
//
// Core type definitions shared across all modules
