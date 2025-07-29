import { spawn, ChildProcess } from 'child_process';
import { URL } from 'url';

export class TestServer {
  private serverProcess: ChildProcess | null = null;
  private port: number;
  private serverReady: boolean = false;

  constructor(port: number = 5002) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Set environment variables for the test database
      const env = {
        ...process.env,
        SHAMAN_DB_HOST: process.env.SHAMAN_DB_HOST || 'localhost',
        SHAMAN_DB_PORT: process.env.SHAMAN_DB_PORT || '5432',
        SHAMAN_DB_NAME: 'shaman_test', // Use test database
        SHAMAN_DB_USER: process.env.SHAMAN_DB_USER || 'postgres',
        SHAMAN_DB_PASSWORD: process.env.SHAMAN_DB_PASSWORD || 'postgres',
        SHAMAN_SERVER_PORT: this.port.toString(),
        NODE_ENV: 'test'
      };

      // Get the path to the server binary
      const serverPath = new URL('../../../shaman-server/dist/bin/shaman-server.js', import.meta.url);
      
      // Start the server process
      this.serverProcess = spawn('node', [serverPath.pathname], {
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let startupTimeout: NodeJS.Timeout;
      let outputBuffer = '';

      const cleanup = () => {
        if (this.serverProcess?.stdout) {
          this.serverProcess.stdout.removeAllListeners();
        }
        if (this.serverProcess?.stderr) {
          this.serverProcess.stderr.removeAllListeners();
        }
        clearTimeout(startupTimeout);
      };

      // Listen for server output
      this.serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        console.log('[Server]', output.trim());
        
        // Look for server ready message
        if (output.includes(`Server ready at`) || output.includes(`listening on port ${this.port}`)) {
          this.serverReady = true;
          cleanup();
          resolve();
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('[Server Error]', data.toString().trim());
      });

      this.serverProcess.on('error', (error) => {
        cleanup();
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      this.serverProcess.on('exit', (code, signal) => {
        if (!this.serverReady) {
          cleanup();
          reject(new Error(`Server exited unexpectedly with code ${code} and signal ${signal}\\nOutput: ${outputBuffer}`));
        }
      });

      // Timeout if server doesn't start
      startupTimeout = setTimeout(() => {
        cleanup();
        this.stop();
        reject(new Error(`Server failed to start within 30 seconds\\nOutput: ${outputBuffer}`));
      }, 30000);
    });
  }

  async stop(): Promise<void> {
    if (this.serverProcess) {
      return new Promise((resolve) => {
        if (!this.serverProcess) {
          resolve();
          return;
        }

        this.serverProcess.on('exit', () => {
          this.serverProcess = null;
          this.serverReady = false;
          resolve();
        });

        // Try graceful shutdown first
        this.serverProcess.kill('SIGTERM');

        // Force kill after timeout
        setTimeout(() => {
          if (this.serverProcess) {
            this.serverProcess.kill('SIGKILL');
          }
        }, 5000);
      });
    }
  }

  isReady(): boolean {
    return this.serverReady;
  }
}