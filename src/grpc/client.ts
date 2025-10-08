import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';

// Types for gRPC client services
export interface JobService {
  RunJob: grpc.handleUnaryCall<any, any>;
  GetJobStatus: grpc.handleUnaryCall<any, any>;
  StopJob: grpc.handleUnaryCall<any, any>;
  DeleteJob: grpc.handleUnaryCall<any, any>;
  DeleteAllJobs: grpc.handleUnaryCall<any, any>;
  GetJobLogs: grpc.handleServerStreamingCall<any, any>;
  ListJobs: grpc.handleUnaryCall<any, any>;
  RunWorkflow: grpc.handleUnaryCall<any, any>;
  GetWorkflowStatus: grpc.handleUnaryCall<any, any>;
  ListWorkflows: grpc.handleUnaryCall<any, any>;
  GetWorkflowJobs: grpc.handleUnaryCall<any, any>;
}

export interface NetworkService {
  CreateNetwork: grpc.handleUnaryCall<any, any>;
  ListNetworks: grpc.handleUnaryCall<any, any>;
  RemoveNetwork: grpc.handleUnaryCall<any, any>;
}

export interface VolumeService {
  CreateVolume: grpc.handleUnaryCall<any, any>;
  ListVolumes: grpc.handleUnaryCall<any, any>;
  RemoveVolume: grpc.handleUnaryCall<any, any>;
}

export interface MonitoringService {
  GetSystemStatus: grpc.handleUnaryCall<any, any>;
  StreamSystemMetrics: grpc.handleServerStreamingCall<any, any>;
}

export interface RuntimeService {
  ListRuntimes: grpc.handleUnaryCall<any, any>;
  GetRuntimeInfo: grpc.handleUnaryCall<any, any>;
  TestRuntime: grpc.handleUnaryCall<any, any>;
}

export interface RnxConfig {
  version: string;
  nodes: {
    [key: string]: {
      address: string;
      cert: string;
      key: string;
      ca: string;
    };
  };
}

interface ClientCache {
  [key: string]: any;
}

export class JobletGrpcClient {
  private jobService: any;
  private networkService: any;
  private volumeService: any;
  private monitoringService: any;
  private runtimeService: any;
  private currentNode: string = 'default';
  private credentials?: grpc.ChannelCredentials;
  private clientCache: ClientCache = {};
  private config: RnxConfig | null = null;
  private configLoadTime = 0;
  private readonly configCacheTtl = 30000; // 30 seconds
  private protoLoaded = false;

  constructor() {
    // Clear client cache on construction to avoid stale clients from hot reload
    this.clientCache = {};
    this.loadProtobuf();
  }

  private loadProtobuf() {
    // Use local proto files since joblet-proto package doesn't exist
    const protoPath = resolve(process.cwd(), 'proto/joblet.proto');

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as any;

    // Initialize service constructors
    this.jobService = proto.joblet.JobService;
    this.networkService = proto.joblet.NetworkService;
    this.volumeService = proto.joblet.VolumeService;
    this.monitoringService = proto.joblet.MonitoringService;
    this.runtimeService = proto.joblet.RuntimeService;
  }

  private loadRnxConfig(): RnxConfig {
    // Check if we have a cached config that's still valid
    const now = Date.now();
    if (this.config && (now - this.configLoadTime) < this.configCacheTtl) {
      return this.config;
    }

    const configPath = process.env.JOBLET_CONFIG_PATH ||
                      process.env.RNX_CONFIG_PATH ||
                      resolve(process.env.HOME || '~', '.rnx/rnx-config.yml');

    try {
      const configContent = readFileSync(configPath, 'utf-8');
      this.config = YAML.parse(configContent);
      this.configLoadTime = now;
      return this.config!;
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error);
      // Return default config
      const defaultConfig = {
        version: '3.0',
        nodes: {
          default: {
            address: 'localhost:50051',
            cert: '',
            key: '',
            ca: ''
          }
        }
      };
      this.config = defaultConfig;
      this.configLoadTime = now;
      return defaultConfig;
    }
  }

  private getCredentials(nodeConfig: any): grpc.ChannelCredentials {
    if (nodeConfig.cert && nodeConfig.key && nodeConfig.ca) {
      console.log('Setting up mTLS credentials...');
      try {
        // Certificates are already in PEM format as strings from YAML
        // Convert strings to Buffers for gRPC
        const clientCert = Buffer.from(nodeConfig.cert.trim());
        const clientKey = Buffer.from(nodeConfig.key.trim());
        const caCert = Buffer.from(nodeConfig.ca.trim());

        console.log('Certificate lengths:', {
          cert: clientCert.length,
          key: clientKey.length,
          ca: caCert.length
        });

        return grpc.credentials.createSsl(caCert, clientKey, clientCert);
      } catch (error) {
        console.error('Error creating SSL credentials:', error);
        throw error;
      }
    } else {
      console.log('Using insecure connection...');
      return grpc.credentials.createInsecure();
    }
  }

  public setNode(node: string) {
    if (this.currentNode !== node) {
      this.currentNode = node;
      this.credentials = undefined; // Reset credentials to force reload
      // Clear client cache for this node to force reconnection
      const cacheKey = `${node}:`;
      Object.keys(this.clientCache)
        .filter(key => key.startsWith(cacheKey))
        .forEach(key => {
          try {
            this.clientCache[key]?.close?.();
          } catch (e) {
            // Ignore close errors
          }
          delete this.clientCache[key];
        });
    }
  }

  private getClient(serviceConstructor: any): any {
    const config = this.loadRnxConfig();
    const nodeConfig = config.nodes[this.currentNode];

    if (!nodeConfig) {
      throw new Error(`Node '${this.currentNode}' not found in configuration`);
    }

    // Create a cache key based on node and service
    const serviceName = serviceConstructor.service?.serviceName ||
                       serviceConstructor.serviceName ||
                       serviceConstructor.name ||
                       'unknown';
    const cacheKey = `${this.currentNode}:${serviceName}`;

    console.log(`Getting client for service: ${serviceName}, cache key: ${cacheKey}`);
    console.log(`Current cache keys:`, Object.keys(this.clientCache));

    // Check if we have a cached client
    if (this.clientCache[cacheKey]) {
      console.log(`Returning cached client for ${serviceName}`);
      return this.clientCache[cacheKey];
    }

    console.log(`Creating new client for ${serviceName}`);

    if (!this.credentials) {
      this.credentials = this.getCredentials(nodeConfig);
    }

    // Create new client with connection options for better stability
    const client = new serviceConstructor(nodeConfig.address, this.credentials, {
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': true,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.http2.min_time_between_pings_ms': 10000,
      'grpc.http2.min_ping_interval_without_data_ms': 300000,
      'grpc.max_connection_idle_ms': 300000,
      'grpc.max_connection_age_ms': 600000,
      'grpc.max_connection_age_grace_ms': 10000,
      'grpc.client_idle_timeout_ms': 300000,
    });

    // Only cache the client if it has methods (proto loaded correctly)
    // Check if client has at least one method from its prototype
    const hasValidMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(client)).length > 1;
    if (hasValidMethods) {
      this.clientCache[cacheKey] = client;
    }

    return client;
  }

  private async retryRequest<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if this is a retryable error
        const isRetryable = error.code === grpc.status.UNAVAILABLE ||
                           error.code === grpc.status.DEADLINE_EXCEEDED ||
                           error.code === grpc.status.INTERNAL ||
                           error.code === 14; // UNAVAILABLE

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        console.warn(`gRPC request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);

        // Clear cached client on connection errors to force reconnection
        if (error.code === grpc.status.UNAVAILABLE || error.code === 14) {
          const cacheKey = `${this.currentNode}:`;
          Object.keys(this.clientCache)
            .filter(key => key.startsWith(cacheKey))
            .forEach(key => {
              try {
                this.clientCache[key]?.close?.();
              } catch (e) {
                // Ignore close errors
              }
              delete this.clientCache[key];
            });
          this.credentials = undefined; // Force credential reload
        }

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    throw lastError;
  }

  // Job Service methods with retry logic
  public async listJobs(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10); // 10 second timeout

        client.ListJobs({}, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async getJobStatus(jobId: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.GetJobStatus({ uuid: jobId }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async runJob(request: any): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 30); // Longer timeout for job creation

        client.RunJob(request, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async stopJob(jobId: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.StopJob({ uuid: jobId }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async deleteJob(jobId: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.DeleteJob({ uuid: jobId }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async deleteAllJobs(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 30); // Longer timeout for bulk operations

        client.DeleteAllJobs({}, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public getJobLogs(jobId: string): grpc.ClientReadableStream<any> {
    const client = this.getClient(this.jobService);
    return client.GetJobLogs({ uuid: jobId });
  }

  public streamJobMetrics(jobId: string): grpc.ClientReadableStream<any> {
    const client = this.getClient(this.jobService);
    return client.StreamJobMetrics({ uuid: jobId });
  }

  // Workflow Service methods
  public async listWorkflows(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.ListWorkflows({ includeCompleted: true }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async getWorkflowStatus(workflowId: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.GetWorkflowStatus({ uuid: workflowId }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async getWorkflowJobs(workflowId: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.GetWorkflowJobs({ workflow_uuid: workflowId }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async runWorkflow(request: any): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.jobService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 30);

        client.RunWorkflow(request, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  // Network Service methods
  public async listNetworks(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        try {
          const client = this.getClient(this.networkService);
          if (!client || typeof client.ListNetworks !== 'function') {
            console.warn('ListNetworks method not available on network service');
            resolve({ networks: [] });
            return;
          }

          const deadline = new Date();
          deadline.setSeconds(deadline.getSeconds() + 10);

          client.ListNetworks({}, { deadline }, (error: any, response: any) => {
            if (error) reject(error);
            else resolve(response);
          });
        } catch (err) {
          console.warn('Network service not available:', err);
          resolve({ networks: [] });
        }
      });
    });
  }

  public async createNetwork(name: string, cidr: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.networkService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.CreateNetwork({ name, cidr }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async removeNetwork(name: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.networkService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.RemoveNetwork({ name }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  // Volume Service methods
  public async listVolumes(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        try {
          const client = this.getClient(this.volumeService);
          if (!client || typeof client.ListVolumes !== 'function') {
            console.error('ListVolumes method not available on volume service');
            console.error('Volume client methods:', client ? Object.getOwnPropertyNames(Object.getPrototypeOf(client)) : 'no client');
            reject(new Error('ListVolumes method not available'));
            return;
          }

          const deadline = new Date();
          deadline.setSeconds(deadline.getSeconds() + 10);

          client.ListVolumes({}, { deadline }, (error: any, response: any) => {
            if (error) {
              console.error('ListVolumes error:', error);
              reject(error);
            } else {
              console.log('ListVolumes response:', response);
              resolve(response);
            }
          });
        } catch (err) {
          console.error('ListVolumes catch error:', err);
          reject(err);
        }
      });
    });
  }

  public async createVolume(name: string, size: string, type: string = 'filesystem'): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.volumeService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 30); // Longer timeout for volume creation

        client.CreateVolume({ name, size, type }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async removeVolume(name: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.volumeService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.RemoveVolume({ name }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  // Monitoring Service methods
  public async getSystemStatus(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.monitoringService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.GetSystemStatus({}, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else {
            // Debug: Log network data from gRPC response
            console.log('[gRPC Client] Raw network data:', {
              networksCount: response.networks?.length || 0,
              firstNetwork: response.networks?.[0],
              hostServerIPs: response.host?.serverIPs || response.host?.server_ips,
              hostMacAddresses: response.host?.macAddresses || response.host?.mac_addresses,
            });
            resolve(response);
          }
        });
      });
    });
  }

  public getSystemMetricsStream(): grpc.ClientReadableStream<any> {
    const client = this.getClient(this.monitoringService);
    return client.StreamSystemMetrics({});
  }

  // Runtime Service methods
  public async listRuntimes(): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        try {
          const client = this.getClient(this.runtimeService);
          if (!client || typeof client.ListRuntimes !== 'function') {
            console.error('ListRuntimes method not available on runtime service');
            console.error('Client methods:', client ? Object.getOwnPropertyNames(Object.getPrototypeOf(client)) : 'no client');
            reject(new Error('ListRuntimes method not available'));
            return;
          }

          const deadline = new Date();
          deadline.setSeconds(deadline.getSeconds() + 10);

          client.ListRuntimes({}, { deadline }, (error: any, response: any) => {
            if (error) {
              console.error('ListRuntimes error:', error);
              reject(error);
            } else {
              console.log('ListRuntimes response:', response);
              resolve(response);
            }
          });
        } catch (err) {
          console.error('ListRuntimes catch error:', err);
          reject(err);
        }
      });
    });
  }

  public async getRuntimeInfo(name: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.runtimeService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.GetRuntimeInfo({ name }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public async testRuntime(name: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.runtimeService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 10);

        client.TestRuntime({ name }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  public streamingInstallRuntimeFromGithub(request: any): grpc.ClientReadableStream<any> {
    const client = this.getClient(this.runtimeService);
    return client.StreamingInstallRuntimeFromGithub(request);
  }

  public async removeRuntime(name: string): Promise<any> {
    return this.retryRequest(() => {
      return new Promise((resolve, reject) => {
        const client = this.getClient(this.runtimeService);
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 30);

        client.RemoveRuntime({ runtime: name }, { deadline }, (error: any, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    });
  }

  // Cleanup method to close all connections
  public close(): void {
    Object.keys(this.clientCache).forEach(key => {
      try {
        this.clientCache[key]?.close?.();
      } catch (e) {
        // Ignore close errors
      }
    });
    this.clientCache = {};
    this.credentials = undefined;
  }
}

// Export singleton instance
export const grpcClient = new JobletGrpcClient();