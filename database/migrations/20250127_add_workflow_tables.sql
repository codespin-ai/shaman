-- Add workflow execution tables

-- Run table (workflow instances)
CREATE TABLE IF NOT EXISTS run (
  id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) NOT NULL,
  initial_input TEXT NOT NULL,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  duration INTEGER, -- in milliseconds
  created_by VARCHAR(255) NOT NULL, -- User ID
  trace_id VARCHAR(255),
  metadata JSONB,
  
  INDEX idx_run_status (status),
  INDEX idx_run_created_by (created_by),
  INDEX idx_run_start_time (start_time)
);

-- Step table (execution units within a run)
CREATE TABLE IF NOT EXISTS step (
  id VARCHAR(255) PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  parent_step_id VARCHAR(255) REFERENCES step(id),
  type VARCHAR(50) NOT NULL, -- agent_execution, llm_call, tool_call, agent_call
  status VARCHAR(50) NOT NULL,
  agent_name VARCHAR(255),
  agent_source VARCHAR(50), -- GIT, A2A_EXTERNAL
  input TEXT,
  output TEXT,
  error TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER, -- in milliseconds
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost DECIMAL(10, 6),
  tool_name VARCHAR(255),
  tool_call_id VARCHAR(255),
  messages JSONB, -- Array of message objects
  metadata JSONB,
  
  INDEX idx_step_run_id (run_id),
  INDEX idx_step_parent (parent_step_id),
  INDEX idx_step_status (status),
  INDEX idx_step_agent (agent_name)
);

-- Workflow data table (immutable data storage for agent collaboration)
CREATE TABLE IF NOT EXISTS workflow_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  created_by_step_id VARCHAR(255) NOT NULL REFERENCES step(id),
  created_by_agent_name VARCHAR(255) NOT NULL,
  created_by_agent_source VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  INDEX idx_workflow_data_run_key (run_id, key),
  INDEX idx_workflow_data_agent (run_id, created_by_agent_name),
  INDEX idx_workflow_data_created (created_at)
);

-- Input request table
CREATE TABLE IF NOT EXISTS input_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL REFERENCES run(id) ON DELETE CASCADE,
  step_id VARCHAR(255) NOT NULL REFERENCES step(id),
  prompt TEXT NOT NULL,
  input_type VARCHAR(50) NOT NULL, -- TEXT, CHOICE, FILE, APPROVAL, STRUCTURED_DATA
  choices JSONB, -- Array of choices for CHOICE type
  required BOOLEAN NOT NULL DEFAULT true,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  timeout_at TIMESTAMP,
  metadata JSONB,
  
  -- Response fields (filled when user responds)
  user_response TEXT,
  response_at TIMESTAMP,
  responded_by VARCHAR(255), -- User ID
  
  INDEX idx_input_request_run (run_id),
  INDEX idx_input_request_step (step_id),
  INDEX idx_input_request_pending (run_id, response_at)
);