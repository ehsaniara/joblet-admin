export type JobStatus =
    | 'INITIALIZING'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED'
    | 'STOPPED'
    | 'QUEUED'
    | 'WAITING'
    | 'CANCELLED'
    | 'PENDING'
    | 'SCHEDULED';

export interface Job {
    id: string;
    command: string;
    args: string[];
    status: JobStatus;
    startTime: string;
    endTime?: string;
    scheduledTime?: string;
    duration: number;
    exitCode?: number;
    maxCPU: number;
    maxMemory: number;
    maxIOBPS: number;
    cpuCores?: string;
    runtime?: string;
    network: string;
    volumes: string[];
    uploads: string[];
    uploadDirs: string[];
    envVars: Record<string, string>;
    secretEnvVars?: Record<string, string>;
    dependsOn: string[];
    resourceUsage?: ResourceUsage;
    // Additional fields from rnx job status
    createdTime?: string;
    workingDir?: string;
    name?: string;
    // GPU fields
    gpuIndices?: number[];
    gpuCount?: number;
    gpuMemoryMb?: number;
    // Node identification
    nodeId?: string;
}

export interface ResourceUsage {
    cpuPercent: number;
    memoryUsed: number;
    memoryPercent: number;
    ioRead: number;
    ioWrite: number;
    diskUsed: number;
}

export interface JobConfig {
    command: string;
    files: string[]; // File paths from upload service
    directories: string[]; // Directory paths from upload service
    maxCpu: number;
    maxMemory: number;
    cpuCores: string;
    maxIobps: number;
    runtime: string;
    network: string;
    volumes: string[];
    envVars: Record<string, string>;
    secretEnvVars: Record<string, string>;
    schedule: string;
    gpuCount: number;
    gpuMemoryMb: number;
}

export interface JobExecuteRequest {
    command: string;
    args?: string[];
    maxCpu?: number;
    maxMemory?: number;
    maxIobps?: number;
    cpuCores?: string;
    runtime?: string;
    network?: string;
    volumes?: string[];
    uploads?: string[];
    uploadDirs?: string[];
    environment?: Record<string, string>;
    secret_environment?: Record<string, string>;
    schedule?: string;
    gpu_count?: number;
    gpu_memory_mb?: number;
}

export interface JobFlag {
    flag: string;
    value: string | number | boolean;
    multiple?: boolean;
}

export interface GeneratedCommand {
    command: string;
    flags: JobFlag[];
    fullCommand: string;
}