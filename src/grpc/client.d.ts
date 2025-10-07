import * as grpc from '@grpc/grpc-js';
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
export declare class JobletGrpcClient {
    private jobService;
    private networkService;
    private volumeService;
    private monitoringService;
    private runtimeService;
    private currentNode;
    private credentials?;
    constructor();
    private loadProtobuf;
    private loadRnxConfig;
    private getCredentials;
    setNode(node: string): void;
    private getClient;
    listJobs(): Promise<any>;
    getJobStatus(jobId: string): Promise<any>;
    runJob(request: any): Promise<any>;
    stopJob(jobId: string): Promise<any>;
    deleteJob(jobId: string): Promise<any>;
    deleteAllJobs(): Promise<any>;
    getJobLogs(jobId: string): grpc.ClientReadableStream<any>;
    listNetworks(): Promise<any>;
    createNetwork(name: string, cidr: string): Promise<any>;
    removeNetwork(name: string): Promise<any>;
    listVolumes(): Promise<any>;
    createVolume(name: string, size: string, type?: string): Promise<any>;
    removeVolume(name: string): Promise<any>;
    getSystemStatus(): Promise<any>;
    getSystemMetricsStream(): grpc.ClientReadableStream<any>;
    listRuntimes(): Promise<any>;
    getRuntimeInfo(name: string): Promise<any>;
    testRuntime(name: string): Promise<any>;
}
export declare const grpcClient: JobletGrpcClient;
//# sourceMappingURL=client.d.ts.map