import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
export class JobletGrpcClient {
    jobService;
    networkService;
    volumeService;
    monitoringService;
    runtimeService;
    currentNode = 'default';
    credentials;
    constructor() {
        this.loadProtobuf();
    }
    loadProtobuf() {
        // Try to load from installed package first, fallback to local proto
        let protoPath;
        try {
            protoPath = resolve(process.cwd(), 'node_modules/joblet-proto/proto/joblet.proto');
        }
        catch {
            protoPath = resolve(process.cwd(), 'proto/joblet.proto');
        }
        const packageDefinition = protoLoader.loadSync(protoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });
        const proto = grpc.loadPackageDefinition(packageDefinition);
        // Initialize service constructors
        this.jobService = proto.joblet.JobService;
        this.networkService = proto.joblet.NetworkService;
        this.volumeService = proto.joblet.VolumeService;
        this.monitoringService = proto.joblet.MonitoringService;
        this.runtimeService = proto.joblet.RuntimeService;
    }
    loadRnxConfig() {
        const configPath = process.env.JOBLET_CONFIG_PATH ||
            process.env.RNX_CONFIG_PATH ||
            resolve(process.env.HOME || '~', '.rnx/rnx-config.yml');
        try {
            const configContent = readFileSync(configPath, 'utf-8');
            return YAML.parse(configContent);
        }
        catch (error) {
            console.warn(`Failed to load config from ${configPath}:`, error);
            // Return default config
            return {
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
        }
    }
    getCredentials(nodeConfig) {
        if (nodeConfig.cert && nodeConfig.key && nodeConfig.ca) {
            // mTLS configuration
            const clientCert = Buffer.from(nodeConfig.cert, 'base64');
            const clientKey = Buffer.from(nodeConfig.key, 'base64');
            const caCert = Buffer.from(nodeConfig.ca, 'base64');
            return grpc.credentials.createSsl(caCert, clientKey, clientCert);
        }
        else {
            // Insecure connection for development
            return grpc.credentials.createInsecure();
        }
    }
    setNode(node) {
        this.currentNode = node;
        this.credentials = undefined; // Reset credentials to force reload
    }
    getClient(serviceConstructor) {
        const config = this.loadRnxConfig();
        const nodeConfig = config.nodes[this.currentNode];
        if (!nodeConfig) {
            throw new Error(`Node '${this.currentNode}' not found in configuration`);
        }
        if (!this.credentials) {
            this.credentials = this.getCredentials(nodeConfig);
        }
        return new serviceConstructor(nodeConfig.address, this.credentials);
    }
    // Job Service methods
    async listJobs() {
        const client = this.getClient(this.jobService);
        return new Promise((resolve, reject) => {
            client.ListJobs({}, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async getJobStatus(jobId) {
        const client = this.getClient(this.jobService);
        return new Promise((resolve, reject) => {
            client.GetJobStatus({ job_id: jobId }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async runJob(request) {
        const client = this.getClient(this.jobService);
        return new Promise((resolve, reject) => {
            client.RunJob(request, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async stopJob(jobId) {
        const client = this.getClient(this.jobService);
        return new Promise((resolve, reject) => {
            client.StopJob({ job_id: jobId }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async deleteJob(jobId) {
        const client = this.getClient(this.jobService);
        return new Promise((resolve, reject) => {
            client.DeleteJob({ job_id: jobId }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async deleteAllJobs() {
        const client = this.getClient(this.jobService);
        return new Promise((resolve, reject) => {
            client.DeleteAllJobs({}, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    getJobLogs(jobId) {
        const client = this.getClient(this.jobService);
        return client.GetJobLogs({ job_id: jobId });
    }
    // Network Service methods
    async listNetworks() {
        const client = this.getClient(this.networkService);
        return new Promise((resolve, reject) => {
            client.ListNetworks({}, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async createNetwork(name, cidr) {
        const client = this.getClient(this.networkService);
        return new Promise((resolve, reject) => {
            client.CreateNetwork({ name, cidr }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async removeNetwork(name) {
        const client = this.getClient(this.networkService);
        return new Promise((resolve, reject) => {
            client.RemoveNetwork({ name }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    // Volume Service methods
    async listVolumes() {
        const client = this.getClient(this.volumeService);
        return new Promise((resolve, reject) => {
            client.ListVolumes({}, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async createVolume(name, size, type = 'filesystem') {
        const client = this.getClient(this.volumeService);
        return new Promise((resolve, reject) => {
            client.CreateVolume({ name, size, type }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async removeVolume(name) {
        const client = this.getClient(this.volumeService);
        return new Promise((resolve, reject) => {
            client.RemoveVolume({ name }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    // Monitoring Service methods
    async getSystemStatus() {
        const client = this.getClient(this.monitoringService);
        return new Promise((resolve, reject) => {
            client.GetSystemStatus({}, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    getSystemMetricsStream() {
        const client = this.getClient(this.monitoringService);
        return client.StreamSystemMetrics({});
    }
    // Runtime Service methods
    async listRuntimes() {
        const client = this.getClient(this.runtimeService);
        return new Promise((resolve, reject) => {
            client.ListRuntimes({}, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async getRuntimeInfo(name) {
        const client = this.getClient(this.runtimeService);
        return new Promise((resolve, reject) => {
            client.GetRuntimeInfo({ name }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
    async testRuntime(name) {
        const client = this.getClient(this.runtimeService);
        return new Promise((resolve, reject) => {
            client.TestRuntime({ name }, (error, response) => {
                if (error)
                    reject(error);
                else
                    resolve(response);
            });
        });
    }
}
// Export singleton instance
export const grpcClient = new JobletGrpcClient();
//# sourceMappingURL=client.js.map