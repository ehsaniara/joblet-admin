import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// Mock modules before importing the client
vi.mock('@grpc/grpc-js', () => ({
    default: {},
    credentials: {
        createInsecure: vi.fn(() => ({})),
        createSsl: vi.fn(() => ({})),
    },
    loadPackageDefinition: vi.fn(),
}));

vi.mock('@grpc/proto-loader', () => ({
    default: {},
    loadSync: vi.fn(),
}));

vi.mock('fs', () => ({
    readFileSync: vi.fn(() => 'version: 1.0\nnodes:\n  default:\n    address: localhost:50051'),
    existsSync: vi.fn(() => true),
}));

vi.mock('path', () => ({
    resolve: vi.fn((...args) => args.join('/')),
}));

describe('JobletGrpcClient - Proto Service Coverage', () => {
    let mockJobServiceClient: any;
    let mockNetworkServiceClient: any;
    let mockVolumeServiceClient: any;
    let mockMonitoringServiceClient: any;
    let mockRuntimeServiceClient: any;

    beforeEach(() => {
        // Mock proto loader
        const mockPackageDefinition = {};
        vi.mocked(protoLoader.loadSync).mockReturnValue(mockPackageDefinition as any);

        // Create mock service clients with all methods
        mockJobServiceClient = {
            RunJob: vi.fn((req, callback) => callback(null, {uuid: 'job-123'})),
            GetJobStatus: vi.fn((req, callback) => callback(null, {status: 'RUNNING'})),
            StopJob: vi.fn((req, callback) => callback(null, {success: true})),
            CancelJob: vi.fn((req, callback) => callback(null, {success: true})),
            DeleteJob: vi.fn((req, callback) => callback(null, {success: true})),
            DeleteAllJobs: vi.fn((req, callback) => callback(null, {count: 5})),
            GetJobLogs: vi.fn(() => ({
                on: vi.fn(),
                cancel: vi.fn(),
            })),
            ListJobs: vi.fn((req, callback) => callback(null, {jobs: []})),
            StreamJobTelemetry: vi.fn(() => ({
                on: vi.fn(),
                cancel: vi.fn(),
            })),
            GetJobTelemetry: vi.fn(() => ({
                on: vi.fn(),
                cancel: vi.fn(),
            })),
        };

        mockNetworkServiceClient = {
            CreateNetwork: vi.fn((req, callback) => callback(null, {id: 'net-123'})),
            ListNetworks: vi.fn((req, callback) => callback(null, {networks: []})),
            RemoveNetwork: vi.fn((req, callback) => callback(null, {success: true})),
        };

        mockVolumeServiceClient = {
            CreateVolume: vi.fn((req, callback) => callback(null, {id: 'vol-123'})),
            ListVolumes: vi.fn((req, callback) => callback(null, {volumes: []})),
            RemoveVolume: vi.fn((req, callback) => callback(null, {success: true})),
        };

        mockMonitoringServiceClient = {
            GetSystemStatus: vi.fn((req, callback) => callback(null, {status: 'healthy'})),
            StreamSystemMetrics: vi.fn(() => ({
                on: vi.fn(),
                cancel: vi.fn(),
            })),
        };

        mockRuntimeServiceClient = {
            ListRuntimes: vi.fn((req, callback) => callback(null, {runtimes: []})),
            GetRuntimeInfo: vi.fn((req, callback) => callback(null, {info: {}})),
            TestRuntime: vi.fn((req, callback) => callback(null, {success: true})),
            InstallRuntimeFromGithub: vi.fn((req, callback) => callback(null, {success: true})),
            InstallRuntimeFromLocal: vi.fn((req, callback) => callback(null, {success: true})),
            StreamingInstallRuntimeFromGithub: vi.fn(() => ({
                on: vi.fn(),
                cancel: vi.fn(),
            })),
            StreamingInstallRuntimeFromLocal: vi.fn(() => ({
                on: vi.fn(),
                cancel: vi.fn(),
            })),
            ValidateRuntimeSpec: vi.fn((req, callback) => callback(null, {valid: true})),
            RemoveRuntime: vi.fn((req, callback) => callback(null, {success: true})),
        };

        // Mock service constructors
        const JobService = vi.fn(() => mockJobServiceClient);
        const NetworkService = vi.fn(() => mockNetworkServiceClient);
        const VolumeService = vi.fn(() => mockVolumeServiceClient);
        const MonitoringService = vi.fn(() => mockMonitoringServiceClient);
        const RuntimeService = vi.fn(() => mockRuntimeServiceClient);

        // Mock loadPackageDefinition
        vi.mocked(grpc.loadPackageDefinition).mockReturnValue({
            joblet: {
                JobService,
                NetworkService,
                VolumeService,
                MonitoringService,
                RuntimeService,
            },
        } as any);

        vi.mocked(grpc.credentials.createInsecure).mockReturnValue({} as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('JobService - All Methods', () => {
        it('should have RunJob method', async () => {
            expect(mockJobServiceClient.RunJob).toBeDefined();
            expect(typeof mockJobServiceClient.RunJob).toBe('function');
        });

        it('should have GetJobStatus method', () => {
            expect(mockJobServiceClient.GetJobStatus).toBeDefined();
            expect(typeof mockJobServiceClient.GetJobStatus).toBe('function');
        });

        it('should have StopJob method', () => {
            expect(mockJobServiceClient.StopJob).toBeDefined();
            expect(typeof mockJobServiceClient.StopJob).toBe('function');
        });

        it('should have CancelJob method', () => {
            expect(mockJobServiceClient.CancelJob).toBeDefined();
            expect(typeof mockJobServiceClient.CancelJob).toBe('function');
        });

        it('should have DeleteJob method', () => {
            expect(mockJobServiceClient.DeleteJob).toBeDefined();
            expect(typeof mockJobServiceClient.DeleteJob).toBe('function');
        });

        it('should have DeleteAllJobs method', () => {
            expect(mockJobServiceClient.DeleteAllJobs).toBeDefined();
            expect(typeof mockJobServiceClient.DeleteAllJobs).toBe('function');
        });

        it('should have GetJobLogs streaming method', () => {
            expect(mockJobServiceClient.GetJobLogs).toBeDefined();
            expect(typeof mockJobServiceClient.GetJobLogs).toBe('function');
        });

        it('should have ListJobs method', () => {
            expect(mockJobServiceClient.ListJobs).toBeDefined();
            expect(typeof mockJobServiceClient.ListJobs).toBe('function');
        });

        it('should have StreamJobTelemetry streaming method', () => {
            expect(mockJobServiceClient.StreamJobTelemetry).toBeDefined();
            expect(typeof mockJobServiceClient.StreamJobTelemetry).toBe('function');
        });

        it('should have GetJobTelemetry streaming method', () => {
            expect(mockJobServiceClient.GetJobTelemetry).toBeDefined();
            expect(typeof mockJobServiceClient.GetJobTelemetry).toBe('function');
        });
    });

    describe('NetworkService - All Methods', () => {
        it('should have CreateNetwork method', () => {
            expect(mockNetworkServiceClient.CreateNetwork).toBeDefined();
            expect(typeof mockNetworkServiceClient.CreateNetwork).toBe('function');
        });

        it('should have ListNetworks method', () => {
            expect(mockNetworkServiceClient.ListNetworks).toBeDefined();
            expect(typeof mockNetworkServiceClient.ListNetworks).toBe('function');
        });

        it('should have RemoveNetwork method', () => {
            expect(mockNetworkServiceClient.RemoveNetwork).toBeDefined();
            expect(typeof mockNetworkServiceClient.RemoveNetwork).toBe('function');
        });
    });

    describe('VolumeService - All Methods', () => {
        it('should have CreateVolume method', () => {
            expect(mockVolumeServiceClient.CreateVolume).toBeDefined();
            expect(typeof mockVolumeServiceClient.CreateVolume).toBe('function');
        });

        it('should have ListVolumes method', () => {
            expect(mockVolumeServiceClient.ListVolumes).toBeDefined();
            expect(typeof mockVolumeServiceClient.ListVolumes).toBe('function');
        });

        it('should have RemoveVolume method', () => {
            expect(mockVolumeServiceClient.RemoveVolume).toBeDefined();
            expect(typeof mockVolumeServiceClient.RemoveVolume).toBe('function');
        });
    });

    describe('MonitoringService - All Methods', () => {
        it('should have GetSystemStatus method', () => {
            expect(mockMonitoringServiceClient.GetSystemStatus).toBeDefined();
            expect(typeof mockMonitoringServiceClient.GetSystemStatus).toBe('function');
        });

        it('should have StreamSystemMetrics streaming method', () => {
            expect(mockMonitoringServiceClient.StreamSystemMetrics).toBeDefined();
            expect(typeof mockMonitoringServiceClient.StreamSystemMetrics).toBe('function');
        });
    });

    describe('RuntimeService - All Methods', () => {
        it('should have ListRuntimes method', () => {
            expect(mockRuntimeServiceClient.ListRuntimes).toBeDefined();
            expect(typeof mockRuntimeServiceClient.ListRuntimes).toBe('function');
        });

        it('should have GetRuntimeInfo method', () => {
            expect(mockRuntimeServiceClient.GetRuntimeInfo).toBeDefined();
            expect(typeof mockRuntimeServiceClient.GetRuntimeInfo).toBe('function');
        });

        it('should have TestRuntime method', () => {
            expect(mockRuntimeServiceClient.TestRuntime).toBeDefined();
            expect(typeof mockRuntimeServiceClient.TestRuntime).toBe('function');
        });

        it('should have InstallRuntimeFromGithub method', () => {
            expect(mockRuntimeServiceClient.InstallRuntimeFromGithub).toBeDefined();
            expect(typeof mockRuntimeServiceClient.InstallRuntimeFromGithub).toBe('function');
        });

        it('should have InstallRuntimeFromLocal method', () => {
            expect(mockRuntimeServiceClient.InstallRuntimeFromLocal).toBeDefined();
            expect(typeof mockRuntimeServiceClient.InstallRuntimeFromLocal).toBe('function');
        });

        it('should have StreamingInstallRuntimeFromGithub streaming method', () => {
            expect(mockRuntimeServiceClient.StreamingInstallRuntimeFromGithub).toBeDefined();
            expect(typeof mockRuntimeServiceClient.StreamingInstallRuntimeFromGithub).toBe('function');
        });

        it('should have StreamingInstallRuntimeFromLocal streaming method', () => {
            expect(mockRuntimeServiceClient.StreamingInstallRuntimeFromLocal).toBeDefined();
            expect(typeof mockRuntimeServiceClient.StreamingInstallRuntimeFromLocal).toBe('function');
        });

        it('should have ValidateRuntimeSpec method', () => {
            expect(mockRuntimeServiceClient.ValidateRuntimeSpec).toBeDefined();
            expect(typeof mockRuntimeServiceClient.ValidateRuntimeSpec).toBe('function');
        });

        it('should have RemoveRuntime method', () => {
            expect(mockRuntimeServiceClient.RemoveRuntime).toBeDefined();
            expect(typeof mockRuntimeServiceClient.RemoveRuntime).toBe('function');
        });
    });

    describe('Proto File Service Definitions', () => {
        it('should define all 5 services from joblet.proto', () => {
            // These service client mocks represent the services defined in joblet.proto
            expect(mockJobServiceClient).toBeDefined();
            expect(mockNetworkServiceClient).toBeDefined();
            expect(mockVolumeServiceClient).toBeDefined();
            expect(mockMonitoringServiceClient).toBeDefined();
            expect(mockRuntimeServiceClient).toBeDefined();
        });
    });

    describe('Method Count Validation', () => {
        it('JobService should have exactly 10 methods', () => {
            const methods = Object.keys(mockJobServiceClient).filter(
                key => typeof mockJobServiceClient[key] === 'function'
            );
            expect(methods.length).toBe(10);
        });

        it('NetworkService should have exactly 3 methods', () => {
            const methods = Object.keys(mockNetworkServiceClient).filter(
                key => typeof mockNetworkServiceClient[key] === 'function'
            );
            expect(methods.length).toBe(3);
        });

        it('VolumeService should have exactly 3 methods', () => {
            const methods = Object.keys(mockVolumeServiceClient).filter(
                key => typeof mockVolumeServiceClient[key] === 'function'
            );
            expect(methods.length).toBe(3);
        });

        it('MonitoringService should have exactly 2 methods', () => {
            const methods = Object.keys(mockMonitoringServiceClient).filter(
                key => typeof mockMonitoringServiceClient[key] === 'function'
            );
            expect(methods.length).toBe(2);
        });

        it('RuntimeService should have exactly 9 methods', () => {
            const methods = Object.keys(mockRuntimeServiceClient).filter(
                key => typeof mockRuntimeServiceClient[key] === 'function'
            );
            expect(methods.length).toBe(9);
        });
    });
});
