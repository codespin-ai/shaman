import { expect } from "chai";
import { gql } from "@apollo/client/core/index.js";
import { testDb, client } from "../index.js";

// TODO: Enable these tests once the workflow execution engine is implemented
describe.skip("Workflow Runs", () => {
  beforeEach(async () => {
    await testDb.truncateAllTables();
  });

  describe("createRun", () => {
    it("should create a new workflow run", async () => {
      const mutation = gql`
        mutation CreateRun($input: CreateRunInput!) {
          createRun(input: $input) {
            id
            status
            initialInput
            startTime
            createdBy
            metadata
          }
        }
      `;

      const result = await client.mutate(mutation, {
        input: {
          initialInput: "Help me analyze this codebase",
          createdBy: "user-123",
          metadata: {
            source: "web-ui",
            projectId: "proj-456",
          },
        },
      });

      const run = result.data?.createRun;
      expect(run?.status).to.equal("PENDING");
      expect(run?.initialInput).to.equal("Help me analyze this codebase");
      expect(run?.createdBy).to.equal("user-123");
      expect(run?.metadata?.source).to.equal("web-ui");
      expect(run?.startTime).to.not.be.null;
    });
  });

  describe("executeAgent", () => {
    it("should execute an agent and create steps", async () => {
      // First create a run
      const createRunMutation = gql`
        mutation CreateRun($input: CreateRunInput!) {
          createRun(input: $input) {
            id
          }
        }
      `;

      const runResult = await client.mutate(createRunMutation, {
        input: {
          initialInput: "Analyze security vulnerabilities",
          createdBy: "user-123",
        },
      });

      const runId = runResult.data?.createRun.id;

      // Execute an agent
      const executeAgentMutation = gql`
        mutation ExecuteAgent($input: ExecuteAgentInput!) {
          executeAgent(input: $input) {
            step {
              id
              runId
              type
              status
              agentName
              agentSource
              input
              output
              startTime
              endTime
              promptTokens
              completionTokens
              cost
            }
            result
          }
        }
      `;

      const executeResult = await client.mutate(executeAgentMutation, {
        input: {
          runId,
          agentName: "security-analyzer",
          agentSource: "GIT",
          input:
            "Analyze security vulnerabilities in the authentication module",
        },
      });

      const execution = executeResult.data?.executeAgent;
      expect(execution?.step.runId).to.equal(runId);
      expect(execution?.step.type).to.equal("agent_execution");
      expect(execution?.step.agentName).to.equal("security-analyzer");
      expect(execution?.step.agentSource).to.equal("GIT");
      expect(execution?.step.status).to.be.oneOf(["IN_PROGRESS", "COMPLETED"]);
    });
  });

  describe("updateRunStatus", () => {
    it("should update run status and calculate duration", async () => {
      // Create a run
      const createMutation = gql`
        mutation CreateRun($input: CreateRunInput!) {
          createRun(input: $input) {
            id
            startTime
          }
        }
      `;

      const createResult = await client.mutate(createMutation, {
        input: {
          initialInput: "Test task",
          createdBy: "user-123",
        },
      });

      const run = createResult.data?.createRun;
      const runId = run.id;

      // Wait a bit to have a measurable duration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update status to completed
      const updateMutation = gql`
        mutation UpdateRunStatus($id: ID!, $status: RunStatus!) {
          updateRunStatus(id: $id, status: $status) {
            id
            status
            endTime
            duration
          }
        }
      `;

      const updateResult = await client.mutate(updateMutation, {
        id: runId,
        status: "COMPLETED",
      });

      const updatedRun = updateResult.data?.updateRunStatus;
      expect(updatedRun?.status).to.equal("COMPLETED");
      expect(updatedRun?.endTime).to.not.be.null;
      expect(updatedRun?.duration).to.be.greaterThan(0);
    });
  });

  describe("runData", () => {
    it("should store and retrieve workflow data", async () => {
      // Create a run and step
      const setupMutation = gql`
        mutation SetupWorkflow(
          $runInput: CreateRunInput!
          $stepInput: CreateStepInput!
        ) {
          run: createRun(input: $runInput) {
            id
          }
          step: createStep(input: $stepInput) {
            id
          }
        }
      `;

      const setupResult = await client.mutate(setupMutation, {
        runInput: {
          initialInput: "Process data",
          createdBy: "user-123",
        },
        stepInput: {
          runId: "", // Would need to be set from run result
          type: "agent_execution",
          agentName: "data-processor",
          agentSource: "GIT",
        },
      });

      const runId = setupResult.data?.run.id;
      const stepId = setupResult.data?.step.id;

      // Store workflow data
      const storeMutation = gql`
        mutation StoreRunData($input: StoreRunDataInput!) {
          storeRunData(input: $input) {
            id
            key
            value
            createdByStepId
            createdByAgentName
            createdAt
          }
        }
      `;

      const storeResult = await client.mutate(storeMutation, {
        input: {
          runId,
          stepId,
          key: "analyzed_entities",
          value: {
            users: ["user1", "user2"],
            roles: ["admin", "viewer"],
          },
          agentName: "data-processor",
          agentSource: "GIT",
        },
      });

      const storedData = storeResult.data?.storeRunData;
      expect(storedData?.key).to.equal("analyzed_entities");
      expect(storedData?.value.users).to.have.members(["user1", "user2"]);

      // Query workflow data
      const query = gql`
        query GetRunData($runId: ID!, $key: String!) {
          runData(runId: $runId, key: $key) {
            id
            key
            value
            createdByAgentName
            createdAt
          }
        }
      `;

      const queryResult = await client.query(query, {
        runId,
        key: "analyzed_entities",
      });

      const retrievedData = queryResult.data?.runData;
      expect(retrievedData).to.have.lengthOf(1);
      expect(retrievedData[0].value).to.deep.equal(storedData?.value);
    });
  });
});
