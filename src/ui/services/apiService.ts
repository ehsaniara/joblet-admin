import {DetailedSystemInfo, Job, JobExecuteRequest, SystemMetrics} from '../types';

interface Volume {
    id?: string;
    name: string;
    size: string;
    type: string;
    created_time?: string;
    mountPath?: string;
}

interface Network {
    id: string;
    name: string;
    type: string;
    subnet: string;
}

interface Runtime {
    id: string;
    name: string;
    version: string;
    size: string;
    sizeBytes?: number;
    description: string;
}

interface RuntimeDetails {
    name: string;
    language: string;
    version: string;
    languageVersion: string;
    description: string;
    sizeBytes: number;
    packages: string[];
    available: boolean;
    requirements: {
        architectures: string[];
        gpu: boolean;
    } | null;
    libraries: string[];
    environment: Record<string, string>;
    buildInfo: {
        builtAt: string;
        builtWith: string;
        platform: string;
    } | null;
    originalYaml: string;
}

interface Node {
    name: string;
    status: string;
}

export const API_BASE_URL = '';

class APIService {
    private baseURL: string;
    private currentNode = 'default';

    constructor() {
        this.baseURL = `${API_BASE_URL}/api`;
    }

    setNode(node: string) {
        this.currentNode = node;
    }

    // Node operations
    async getNodes(): Promise<Node[]> {
        return this.request<Node[]>('/nodes', {}, false); // Don't add node param for this call
    }

    // Job operations
    async getJobs(): Promise<Job[]> {
        return this.request<Job[]>('/jobs');
    }

    async getJob(jobId: string): Promise<Job> {
        return this.request<Job>(`/jobs/${jobId}`);
    }

    async getJobStatus(jobId: string): Promise<any> {
        return this.request<any>(`/jobs/${jobId}/status`);
    }

    async executeJob(request: JobExecuteRequest): Promise<{ jobId: string }> {
        return this.request<{ jobId: string }>('/jobs/execute', {
            method: 'POST',
            body: JSON.stringify({...request, node: this.currentNode}),
        });
    }

    async stopJob(jobId: string): Promise<void> {
        await this.request(`/jobs/${jobId}/stop`, {
            method: 'POST',
            body: JSON.stringify({node: this.currentNode}),
        });
    }

    async cancelJob(jobId: string): Promise<void> {
        await this.request(`/jobs/${jobId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({node: this.currentNode}),
        });
    }

    async deleteJob(jobId: string): Promise<void> {
        await this.request(`/jobs/${jobId}?node=${this.currentNode}`, {
            method: 'DELETE',
        });
    }

    async deleteAllJobs(): Promise<{ message: string; output: string }> {
        return this.request<{ message: string; output: string }>(`/jobs?node=${this.currentNode}`, {
            method: 'DELETE',
        });
    }

    async getJobLogs(jobId: string): Promise<{ logs: string[] }> {
        return this.request<{ logs: string[] }>(`/jobs/${jobId}/logs`);
    }

    async getJobMetrics(jobId: string, watch = false): Promise<any[]> {
        const url = watch ? `/jobs/${jobId}/metrics?watch=true` : `/jobs/${jobId}/metrics`;
        return this.request<any[]>(url);
    }

    // System monitoring
    async getSystemMetrics(): Promise<SystemMetrics> {
        return this.request<SystemMetrics>('/monitor');
    }

    async getDetailedSystemInfo(): Promise<DetailedSystemInfo> {
        return this.request<DetailedSystemInfo>('/system-info');
    }

    // Volume operations
    async getVolumes(): Promise<{ volumes: Volume[] }> {
        return this.request<{ volumes: Volume[] }>('/volumes');
    }

    async deleteVolume(volumeName: string): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>(`/volumes/${encodeURIComponent(volumeName)}`, {
            method: 'DELETE',
        });
    }

    async createVolume(name: string, size: string, type = 'filesystem'): Promise<{
        success: boolean;
        message: string
    }> {
        return this.request<{ success: boolean; message: string }>('/volumes', {
            method: 'POST',
            body: JSON.stringify({name, size, type}),
        });
    }

    // Network operations
    async getNetworks(): Promise<{ networks: Network[] }> {
        return this.request<{ networks: Network[] }>('/networks');
    }

    async createNetwork(name: string, cidr: string): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>('/networks', {
            method: 'POST',
            body: JSON.stringify({name, cidr}),
        });
    }

    async deleteNetwork(networkName: string): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>(`/networks/${encodeURIComponent(networkName)}`, {
            method: 'DELETE',
        });
    }

    // Runtime operations
    async getRuntimes(): Promise<{ runtimes: Runtime[] }> {
        return this.request<{ runtimes: Runtime[] }>('/runtimes');
    }

    async deleteRuntime(runtimeName: string): Promise<{ success: boolean; message: string }> {
        return this.request<{ success: boolean; message: string }>(`/runtimes/${encodeURIComponent(runtimeName)}`, {
            method: 'DELETE',
        });
    }

    async getRuntimeDetails(runtimeName: string): Promise<RuntimeDetails> {
        return this.request<RuntimeDetails>(`/runtimes/${encodeURIComponent(runtimeName)}`);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        includeNode = true
    ): Promise<T> {
        // Add node parameter to GET requests
        let url = `${this.baseURL}${endpoint}`;
        if (includeNode && (!options.method || options.method === 'GET')) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}node=${encodeURIComponent(this.currentNode)}`;
        }

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    }
}

export const apiService = new APIService();