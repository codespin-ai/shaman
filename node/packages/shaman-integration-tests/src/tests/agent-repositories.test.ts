import { expect } from 'chai';
import { gql } from '@apollo/client/core/index.js';
import { testDb, client } from '../index.js';

// TODO: Enable these tests once the GraphQL schema and resolvers are implemented
describe.skip('Agent Repositories', () => {
  beforeEach(async () => {
    await testDb.truncateAllTables();
  });

  describe('createAgentRepository', () => {
    it('should create a new agent repository', async () => {
      const mutation = gql`
        mutation CreateAgentRepository($input: CreateAgentRepositoryInput!) {
          createAgentRepository(input: $input) {
            id
            name
            gitUrl
            branch
            isRoot
            lastSyncCommitHash
            lastSyncAt
            lastSyncStatus
          }
        }
      `;

      const result = await client.mutate(mutation, {
        input: {
          name: 'test-agents',
          gitUrl: 'https://github.com/example/test-agents.git',
          branch: 'main',
          isRoot: true
        }
      });

      const repo = result.data?.createAgentRepository;
      expect(repo?.name).to.equal('test-agents');
      expect(repo?.gitUrl).to.equal('https://github.com/example/test-agents.git');
      expect(repo?.branch).to.equal('main');
      expect(repo?.isRoot).to.be.true;
      expect(repo?.lastSyncStatus).to.equal('NEVER_SYNCED');
    });

    it('should fail with duplicate repository name', async () => {
      const mutation = gql`
        mutation CreateAgentRepository($input: CreateAgentRepositoryInput!) {
          createAgentRepository(input: $input) {
            id
            name
          }
        }
      `;

      // Create first repository
      await client.mutate(mutation, {
        input: {
          name: 'test-agents',
          gitUrl: 'https://github.com/example/test-agents.git',
          branch: 'main'
        }
      });

      // Try to create duplicate
      try {
        await client.mutate(mutation, {
          input: {
            name: 'test-agents',
            gitUrl: 'https://github.com/example/other-agents.git',
            branch: 'main'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('duplicate');
      }
    });
  });

  describe('syncAgentRepository', () => {
    it('should sync agents from a git repository', async () => {
      // First create a repository
      const createMutation = gql`
        mutation CreateAgentRepository($input: CreateAgentRepositoryInput!) {
          createAgentRepository(input: $input) {
            id
          }
        }
      `;

      const createResult = await client.mutate(createMutation, {
        input: {
          name: 'test-agents',
          gitUrl: 'https://github.com/example/test-agents.git',
          branch: 'main'
        }
      });

      const repoId = createResult.data?.createAgentRepository.id;

      // Then sync it
      const syncMutation = gql`
        mutation SyncAgentRepository($id: ID!) {
          syncAgentRepository(id: $id) {
            id
            lastSyncCommitHash
            lastSyncAt
            lastSyncStatus
            agents {
              id
              name
              description
              filePath
            }
          }
        }
      `;

      const syncResult = await client.mutate(syncMutation, { id: repoId });
      const syncedRepo = syncResult.data?.syncAgentRepository;

      expect(syncedRepo?.lastSyncStatus).to.equal('SYNCED');
      expect(syncedRepo?.lastSyncCommitHash).to.not.be.null;
      expect(syncedRepo?.lastSyncAt).to.not.be.null;
      expect(syncedRepo?.agents).to.be.an('array');
    });
  });

  describe('listAgentRepositories', () => {
    it('should list all agent repositories', async () => {
      // Create some repositories
      const createMutation = gql`
        mutation CreateAgentRepository($input: CreateAgentRepositoryInput!) {
          createAgentRepository(input: $input) {
            id
          }
        }
      `;

      await client.mutate(createMutation, {
        input: {
          name: 'agents-1',
          gitUrl: 'https://github.com/example/agents-1.git',
          branch: 'main'
        }
      });

      await client.mutate(createMutation, {
        input: {
          name: 'agents-2',
          gitUrl: 'https://github.com/example/agents-2.git',
          branch: 'develop'
        }
      });

      // List repositories
      const query = gql`
        query ListAgentRepositories {
          agentRepositories {
            id
            name
            gitUrl
            branch
            isRoot
            lastSyncStatus
          }
        }
      `;

      const result = await client.query(query);
      const repos = result.data?.agentRepositories;

      expect(repos).to.be.an('array');
      expect(repos).to.have.lengthOf(2);
      expect(repos.map((r: any) => r.name)).to.include.members(['agents-1', 'agents-2']);
    });
  });
});