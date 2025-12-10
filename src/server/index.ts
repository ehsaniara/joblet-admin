import express from 'express';
import cors from 'cors';
import http from 'http';
import {WebSocketServer} from 'ws';
import {grpcClient} from '../grpc/client.js';

// Type-safe telemetry event type mapping
type ProtoEventType = 'exec' | 'connect' | 'accept' | 'send' | 'recv' | 'mmap' | 'mprotect' | 'file' | 'metrics';
type FrontendEventType = 'EXEC' | 'NET' | 'ACCEPT' | 'SEND' | 'RECV' | 'MMAP' | 'MPROTECT' | 'FILE' | 'metrics' | 'UNKNOWN';

const PROTO_TO_FRONTEND_EVENT_MAP: Record<ProtoEventType, FrontendEventType> = {
    'exec': 'EXEC',
    'connect': 'NET',      // Outgoing connections
    'accept': 'ACCEPT',    // Incoming connections
    'send': 'SEND',
    'recv': 'RECV',
    'mmap': 'MMAP',
    'mprotect': 'MPROTECT',
    'file': 'FILE',
    'metrics': 'metrics',
};

const VALID_PROTO_TYPES = new Set<string>(Object.keys(PROTO_TO_FRONTEND_EVENT_MAP));

function mapEventType(protoType: string | undefined | null): FrontendEventType {
    if (!protoType) return 'UNKNOWN';
    const normalizedType = protoType.toLowerCase();
    if (VALID_PROTO_TYPES.has(normalizedType)) {
        return PROTO_TO_FRONTEND_EVENT_MAP[normalizedType as ProtoEventType];
    }
    return 'UNKNOWN';
}

const app = express();
const port = process.env.JOBLET_ADMIN_PORT || 5175;
const host = process.env.JOBLET_ADMIN_HOST || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());

// Node selection middleware - extracts node from query/body and sets it on gRPC client
app.use((req, res, next) => {
    try {
        // Get node from query parameter or body
        let node = req.query.node as string || req.body?.node || 'default';

        // Set the node on the gRPC client for this request
        grpcClient.setNode(node);

        next();
    } catch (error) {
        console.error('Error setting node:', error);
        next(); // Continue even if node setting fails
    }
});

// Basic health check
app.get('/health', (req, res) => {
    res.json({status: 'ok', timestamp: new Date().toISOString()});
});

// Test gRPC connection
app.get('/api/test', async (req, res) => {
    try {
        // Try to list jobs to test the gRPC connection
        const jobs = await grpcClient.listJobs();
        res.json({
            status: 'connected',
            grpc: 'ok',
            jobCount: jobs?.jobs?.length || 0
        });
    } catch (error) {
        console.error('gRPC connection test failed:', error);
        res.status(500).json({
            status: 'error',
            grpc: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Job endpoints (basic implementation)
app.get('/api/jobs', async (req, res) => {
    try {
        const result = await grpcClient.listJobs();
        // Normalize job objects to ensure 'id' field exists
        const jobs = (result?.jobs || []).map((job: any) => ({
            ...job,
            id: job.id || job.uuid, // Ensure id field is present
        }));
        res.json(jobs);
    } catch (error) {
        console.error('Failed to list jobs:', error);
        res.status(500).json({error: 'Failed to list jobs'});
    }
});

app.get('/api/jobs/:jobId', async (req, res) => {
    const {jobId} = req.params;
    try {
        console.log(`Getting job: ${jobId}`);
        // Get basic job info from the jobs list
        const jobs = await grpcClient.listJobs();
        const job = jobs?.jobs?.find((j: any) => j.id === jobId || j.uuid === jobId);
        if (!job) {
            console.log(`Job not found: ${jobId}`);
            return res.status(404).json({error: 'Job not found'});
        }
        // Normalize job object
        res.json({
            ...job,
            id: job.id || job.uuid,
        });
    } catch (error) {
        console.error(`Failed to get job ${jobId}:`, error);
        res.status(500).json({
            error: 'Failed to get job',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get job status endpoint for job details
app.get('/api/jobs/:jobId/status', async (req, res) => {
    const {jobId} = req.params;
    try {
        if (!jobId || jobId.trim() === '') {
            console.error('Empty job ID received');
            return res.status(400).json({error: 'Job ID is required'});
        }
        console.log(`Getting status for job: ${jobId}`);
        const result = await grpcClient.getJobStatus(jobId);
        // Map uuid to id for consistency with frontend Job type
        res.json({
            ...result,
            id: result.id || result.uuid,
        });
    } catch (error) {
        console.error(`Failed to get job status for ${jobId}:`, error);
        res.status(500).json({
            error: 'Failed to get job status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Stop job endpoint
app.post('/api/jobs/:jobId/stop', async (req, res) => {
    try {
        const {jobId} = req.params;
        const result = await grpcClient.stopJob(jobId);
        res.json(result);
    } catch (error) {
        console.error('Failed to stop job:', error);
        res.status(500).json({error: 'Failed to stop job'});
    }
});

// Cancel job endpoint
app.post('/api/jobs/:jobId/cancel', async (req, res) => {
    try {
        const {jobId} = req.params;
        // For now, use stop job as cancel (same functionality)
        const result = await grpcClient.stopJob(jobId);
        res.json(result);
    } catch (error) {
        console.error('Failed to cancel job:', error);
        res.status(500).json({error: 'Failed to cancel job'});
    }
});

// Delete job endpoint
app.delete('/api/jobs/:jobId', async (req, res) => {
    const {jobId} = req.params;
    try {
        if (!jobId || jobId.trim() === '') {
            console.error('Empty job ID received for deletion');
            return res.status(400).json({error: 'Job ID is required'});
        }
        console.log(`Deleting job: ${jobId}`);
        const result = await grpcClient.deleteJob(jobId);
        res.json(result);
    } catch (error) {
        console.error(`Failed to delete job ${jobId}:`, error);
        res.status(500).json({
            error: 'Failed to delete job',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Delete all jobs endpoint
app.delete('/api/jobs', async (req, res) => {
    try {
        const result = await grpcClient.deleteAllJobs();
        res.json(result);
    } catch (error) {
        console.error('Failed to delete all jobs:', error);
        res.status(500).json({error: 'Failed to delete all jobs'});
    }
});

app.post('/api/jobs', async (req, res) => {
    try {
        const result = await grpcClient.runJob(req.body);
        res.json(result);
    } catch (error) {
        console.error('Failed to run job:', error);
        res.status(500).json({error: 'Failed to run job'});
    }
});

// Volume endpoints
app.get('/api/volumes', async (req, res) => {
    try {
        const result = await grpcClient.listVolumes();
        res.json({volumes: result?.volumes || []});
    } catch (error) {
        console.error('Failed to list volumes:', error);
        res.status(500).json({error: 'Failed to list volumes'});
    }
});

app.post('/api/volumes', async (req, res) => {
    try {
        const {name, size, type} = req.body;
        const result = await grpcClient.createVolume(name, size, type);
        res.json({success: true, volume: result});
    } catch (error: any) {
        console.error('Failed to create volume:', error);
        res.status(500).json({
            error: 'Failed to create volume',
            message: error.message || 'Unknown error'
        });
    }
});

app.delete('/api/volumes/:name', async (req, res) => {
    try {
        const {name} = req.params;
        await grpcClient.removeVolume(name);
        res.json({success: true, message: 'Volume deleted successfully'});
    } catch (error: any) {
        console.error('Failed to delete volume:', error);
        res.status(500).json({
            error: 'Failed to delete volume',
            message: error.message || 'Unknown error'
        });
    }
});

// Network endpoints
app.get('/api/networks', async (req, res) => {
    try {
        const result = await grpcClient.listNetworks();
        res.json({networks: result?.networks || []});
    } catch (error) {
        console.error('Failed to list networks:', error);
        res.status(500).json({error: 'Failed to list networks'});
    }
});

app.post('/api/networks', async (req, res) => {
    try {
        const {name, cidr} = req.body;
        const result = await grpcClient.createNetwork(name, cidr);
        res.json({success: true, network: result});
    } catch (error: any) {
        console.error('Failed to create network:', error);
        res.status(500).json({
            error: 'Failed to create network',
            message: error.message || 'Unknown error'
        });
    }
});

app.delete('/api/networks/:name', async (req, res) => {
    try {
        const {name} = req.params;
        await grpcClient.removeNetwork(name);
        res.json({success: true, message: 'Network deleted successfully'});
    } catch (error: any) {
        console.error('Failed to delete network:', error);
        res.status(500).json({
            error: 'Failed to delete network',
            message: error.message || 'Unknown error'
        });
    }
});

// Runtime endpoints
app.get('/api/runtimes', async (req, res) => {
    try {
        const result = await grpcClient.listRuntimes();
        res.json({runtimes: result?.runtimes || []});
    } catch (error) {
        console.error('Failed to list runtimes:', error);
        res.status(500).json({error: 'Failed to list runtimes'});
    }
});

// Active runtime build streams
const runtimeBuildStreams = new Map<string, any>();

// Runtime build endpoint - builds runtime from YAML specification
app.post('/api/runtimes/build', async (req, res) => {
    try {
        const {yamlContent, dryRun, verbose, forceRebuild} = req.body;

        if (!yamlContent) {
            return res.status(400).json({error: 'YAML content is required'});
        }

        // Generate a unique session ID for this build
        const sessionId = `build-${Date.now()}`;

        console.log(`Building runtime from YAML (session: ${sessionId}, dryRun: ${dryRun}, forceRebuild: ${forceRebuild})`);

        // Create session entry BEFORE sending response to avoid race condition
        runtimeBuildStreams.set(sessionId, {logs: [], completed: false, sentCount: 0});

        // Return immediately with session ID so client can connect to WebSocket
        res.json({
            sessionId: sessionId,
            message: 'Build started. Connect to WebSocket for progress.'
        });

        // Start the streaming build after response is sent
        setImmediate(() => {
            try {
                const stream = grpcClient.buildRuntime(yamlContent, {
                    dryRun: dryRun || false,
                    verbose: verbose || false,
                    forceRebuild: forceRebuild || false
                });
                const sessionData = runtimeBuildStreams.get(sessionId);
                if (sessionData) {
                    sessionData.stream = stream;
                }

                stream.on('data', (chunk: any) => {
                const sessionData = runtimeBuildStreams.get(sessionId);
                if (!sessionData) return;

                // Handle BuildRuntimeProgress message types
                if (chunk.phase) {
                    // BuildPhaseProgress
                    const phaseMsg = `[${chunk.phase.phase_number}/${chunk.phase.total_phases}] ${chunk.phase.phase_name}: ${chunk.phase.message}`;
                    console.log(`Phase: ${phaseMsg}`);
                    sessionData.logs.push({
                        type: 'progress',
                        message: chunk.phase.message,
                        phaseName: chunk.phase.phase_name,
                        step: chunk.phase.phase_number,
                        totalSteps: chunk.phase.total_phases,
                        timestamp: new Date().toISOString()
                    });
                } else if (chunk.log) {
                    // BuildLogLine
                    console.log(`[${chunk.log.level}] ${chunk.log.message}`);
                    sessionData.logs.push({
                        type: 'log',
                        level: chunk.log.level,
                        message: chunk.log.message,
                        timestamp: new Date().toISOString()
                    });
                } else if (chunk.result) {
                    // BuildResult
                    console.log(`Build result: success=${chunk.result.success}, runtime=${chunk.result.runtime_name}`);
                    if (chunk.result.success) {
                        sessionData.logs.push({
                            type: 'complete',
                            message: chunk.result.message || 'Build completed successfully',
                            runtimeName: chunk.result.runtime_name,
                            runtimeVersion: chunk.result.runtime_version,
                            installPath: chunk.result.install_path,
                            sizeBytes: chunk.result.size_bytes,
                            buildDurationMs: chunk.result.build_duration_ms,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        sessionData.logs.push({
                            type: 'error',
                            message: chunk.result.message || 'Build failed',
                            timestamp: new Date().toISOString()
                        });
                    }
                    sessionData.completed = true;
                    sessionData.success = chunk.result.success;
                }
            });

            stream.on('end', () => {
                const sessionData = runtimeBuildStreams.get(sessionId);
                if (sessionData && !sessionData.completed) {
                    sessionData.completed = true;
                    sessionData.logs.push({
                        type: 'complete',
                        message: 'Build stream ended',
                        timestamp: new Date().toISOString()
                    });
                    console.log(`Runtime build completed: ${sessionId}`);
                }
                // Keep session data for 30 seconds for late WebSocket connections
                setTimeout(() => runtimeBuildStreams.delete(sessionId), 30000);
            });

            stream.on('error', (error: any) => {
                console.error(`Runtime build error:`, error);
                const sessionData = runtimeBuildStreams.get(sessionId);
                if (sessionData) {
                    sessionData.completed = true;
                    sessionData.success = false;
                    sessionData.error = error.details || error.message || 'Unknown error';
                    sessionData.logs.push({
                        type: 'error',
                        message: error.details || error.message || 'Unknown error',
                        timestamp: new Date().toISOString()
                    });
                }
            });
            } catch (streamError: any) {
                console.error('Failed to create build stream:', streamError);
                const sessionData = runtimeBuildStreams.get(sessionId);
                if (sessionData) {
                    sessionData.completed = true;
                    sessionData.success = false;
                    sessionData.error = streamError.details || streamError.message || 'Failed to connect to joblet server';
                    sessionData.logs.push({
                        type: 'error',
                        message: `Failed to start build: ${streamError.details || streamError.message || 'Connection failed'}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    } catch (error) {
        console.error('Failed to build runtime:', error);
        res.status(500).json({
            error: 'Failed to build runtime',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Validate runtime YAML endpoint
app.post('/api/runtimes/validate', async (req, res) => {
    try {
        const {yamlContent} = req.body;

        if (!yamlContent) {
            return res.status(400).json({error: 'YAML content is required'});
        }

        console.log('Validating runtime YAML');
        const result = await grpcClient.validateRuntimeYAML(yamlContent);

        res.json({
            valid: result.valid,
            message: result.message,
            errors: result.errors || [],
            warnings: result.warnings || [],
            specInfo: result.spec_info ? {
                name: result.spec_info.name,
                version: result.spec_info.version,
                language: result.spec_info.language,
                languageVersion: result.spec_info.language_version,
                description: result.spec_info.description,
                pipPackages: result.spec_info.pip_packages || [],
                npmPackages: result.spec_info.npm_packages || [],
                hasHooks: result.spec_info.has_hooks,
                requiresGpu: result.spec_info.requires_gpu
            } : null
        });
    } catch (error) {
        console.error('Failed to validate runtime YAML:', error);
        res.status(500).json({
            error: 'Failed to validate runtime YAML',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Runtime removal endpoint
app.delete('/api/runtimes/:name', async (req, res) => {
    try {
        const {name} = req.params;

        if (!name) {
            return res.status(400).json({error: 'Runtime name is required'});
        }

        console.log(`Removing runtime: ${name}`);

        const result = await grpcClient.removeRuntime(name);

        res.json({
            message: `Runtime ${name} removed successfully`,
            success: true,
            ...result
        });
    } catch (error) {
        console.error(`Failed to remove runtime ${req.params.name}:`, error);
        res.status(500).json({
            error: 'Failed to remove runtime',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get runtime details endpoint
app.get('/api/runtimes/:name', async (req, res) => {
    try {
        const {name} = req.params;

        if (!name) {
            return res.status(400).json({error: 'Runtime name is required'});
        }

        console.log(`Getting runtime info: ${name}`);

        const result = await grpcClient.getRuntimeInfo(name);

        if (!result.found) {
            return res.status(404).json({error: `Runtime '${name}' not found`});
        }

        // Transform the runtime info to match frontend expectations
        const runtime = result.runtime;
        res.json({
            name: runtime.name,
            language: runtime.language,
            version: runtime.version,
            languageVersion: runtime.language_version || runtime.languageVersion,
            description: runtime.description,
            sizeBytes: runtime.sizeBytes || runtime.size_bytes,
            packages: runtime.packages || [],
            available: runtime.available,
            requirements: runtime.requirements ? {
                architectures: runtime.requirements.architectures || [],
                gpu: runtime.requirements.gpu || false
            } : null,
            libraries: runtime.libraries || [],
            environment: runtime.environment || {},
            buildInfo: runtime.build_info || runtime.buildInfo ? {
                builtAt: runtime.build_info?.built_at || runtime.buildInfo?.builtAt,
                builtWith: runtime.build_info?.built_with || runtime.buildInfo?.builtWith,
                platform: runtime.build_info?.platform || runtime.buildInfo?.platform
            } : null,
            originalYaml: runtime.original_yaml || runtime.originalYaml
        });
    } catch (error) {
        console.error(`Failed to get runtime info ${req.params.name}:`, error);
        res.status(500).json({
            error: 'Failed to get runtime info',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Node endpoints
app.get('/api/nodes', async (req, res) => {
    try {
        // Import required modules
        const fs = await import('fs');
        const pathModule = await import('path');
        const os = await import('os');
        const yaml = await import('yaml');

        // Load config from ~/.rnx/rnx-config.yml
        const configPath = process.env.JOBLET_CONFIG_PATH ||
            process.env.RNX_CONFIG_PATH ||
            pathModule.resolve(os.homedir(), '.rnx/rnx-config.yml');

        if (!fs.existsSync(configPath)) {
            // Return default node if config doesn't exist
            return res.json([{name: 'default', status: 'active'}]);
        }

        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.parse(configContent);

        // Extract nodes from config
        const nodes = Object.keys(config.nodes || {}).map(nodeName => ({
            name: nodeName,
            status: 'active' // We assume all configured nodes are active
        }));

        // If no nodes found, return default
        if (nodes.length === 0) {
            return res.json([{name: 'default', status: 'active'}]);
        }

        res.json(nodes);
    } catch (error) {
        console.error('Failed to list nodes:', error);
        // Return default node on error
        res.json([{name: 'default', status: 'active'}]);
    }
});

// Version endpoint
app.get('/api/version', async (req, res) => {
    try {
        // For now, return a mock version - this would typically come from gRPC
        res.json({version: '1.0.0', node: req.query.node || 'default'});
    } catch (error) {
        console.error('Failed to get version:', error);
        res.status(500).json({error: 'Failed to get version'});
    }
});

// Settings endpoint
app.get('/api/settings', async (req, res) => {
    try {
        // Return settings in the format the frontend expects
        res.json({
            refreshFrequency: 30, // seconds (default 30s)
            language: 'en',
            timezone: 'UTC'
        });
    } catch (error) {
        console.error('Failed to get settings:', error);
        res.status(500).json({error: 'Failed to get settings'});
    }
});

// Get job logs endpoint - fetches logs from job service
app.get('/api/jobs/:jobId/logs', async (req, res) => {
    const {jobId} = req.params;
    try {
        console.log(`Getting logs for job: ${jobId}`);

        const logs: string[] = [];
        const stream = grpcClient.getJobLogs(jobId);

        stream.on('data', (logLine: any) => {
            if (logLine.content) {
                const logText = Buffer.from(logLine.content).toString('utf-8');
                logs.push(logText);
            }
        });

        stream.on('end', () => {
            console.log(`Retrieved ${logs.length} log lines for job: ${jobId}`);
            res.json({logs});
        });

        stream.on('error', (error: any) => {
            console.error(`Failed to get logs for ${jobId}:`, error);
            // Return empty logs instead of error for better user experience
            res.json({logs: []});
        });
    } catch (error) {
        console.error(`Failed to get logs for ${jobId}:`, error);
        res.status(500).json({
            error: 'Failed to get job logs',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Helper function to transform JobMetricsEvent to frontend format
function transformMetricsEvent(event: any, jobId: string) {
    return {
        jobId: event.job_id || jobId,
        timestamp: event.timestamp ? Number(event.timestamp) / 1e9 : Date.now() / 1000,
        sampleIntervalSeconds: 5,
        type: 'metrics',
        cpu: {
            usage: event.cpu_percent || 0,
            usagePercent: event.cpu_percent || 0,
        },
        memory: {
            current: Number(event.memory_bytes) || 0,
            limit: Number(event.memory_limit) || 0,
        },
        io: {
            readBytes: Number(event.disk_read_bytes) || 0,
            writeBytes: Number(event.disk_write_bytes) || 0,
            totalReadBytes: Number(event.disk_read_bytes) || 0,
            totalWriteBytes: Number(event.disk_write_bytes) || 0,
        },
        network: {
            rxBytes: Number(event.net_recv_bytes) || 0,
            txBytes: Number(event.net_sent_bytes) || 0,
        },
        gpu: {
            percent: event.gpu_percent || 0,
            memoryBytes: Number(event.gpu_memory_bytes) || 0,
        },
        process: {},
        limits: {},
    };
}

// Helper function to transform TelematicsEvent to frontend format
function transformTelematicsEvent(event: any, jobId: string) {
    const eventType = mapEventType(event.type);
    const baseEvent = {
        jobId: event.job_id || jobId,
        timestamp: event.timestamp ? Number(event.timestamp) / 1e9 : Date.now() / 1000,
        type: eventType,
    };

    if (eventType === 'EXEC' && event.exec) {
        const binary = event.exec.binary || '';
        const comm = binary.split('/').pop() || '';
        return {
            ...baseEvent,
            exec: {
                pid: event.exec.pid || 0,
                ppid: event.exec.ppid || 0,
                comm: comm,
                filename: binary,
                args: event.exec.args || [],
                uid: event.exec.uid || 0,
                gid: event.exec.gid || 0,
                exit_code: event.exec.exit_code,
            },
        };
    } else if (eventType === 'NET' && event.connect) {
        return {
            ...baseEvent,
            net: {
                pid: event.connect.pid || 0,
                comm: '',
                src_addr: event.connect.local_address || '',
                src_port: event.connect.local_port || 0,
                dst_addr: event.connect.address || '',
                dst_port: event.connect.port || 0,
                protocol: event.connect.protocol || 'TCP',
            },
        };
    } else if (eventType === 'ACCEPT' && event.accept) {
        return {
            ...baseEvent,
            accept: {
                pid: event.accept.pid || 0,
                comm: '',
                src_addr: event.accept.address || '',
                src_port: event.accept.port || 0,
                dst_addr: event.accept.local_address || '',
                dst_port: event.accept.local_port || 0,
                protocol: event.accept.protocol || 'TCP',
            },
        };
    } else if (eventType === 'FILE' && event.file) {
        return {
            ...baseEvent,
            file: {
                pid: event.file.pid || 0,
                path: event.file.path || '',
                operation: event.file.operation || '',
                bytes: Number(event.file.bytes) || 0,
            },
        };
    } else if (eventType === 'MMAP' && event.mmap) {
        return {
            ...baseEvent,
            mmap: {
                pid: event.mmap.pid || 0,
                comm: '',
                addr: event.mmap.addr || '0x0',
                length: event.mmap.length || 0,
                prot: event.mmap.prot || 0,
                flags: event.mmap.flags || 0,
                fd: event.mmap.fd || -1,
                filename: event.mmap.filename,
            },
        };
    } else if (eventType === 'MPROTECT' && event.mprotect) {
        return {
            ...baseEvent,
            mprotect: {
                pid: event.mprotect.pid || 0,
                comm: '',
                addr: event.mprotect.addr || '0x0',
                length: event.mprotect.length || 0,
                prot: event.mprotect.prot || 0,
                old_prot: event.mprotect.old_prot,
            },
        };
    } else if (event.socket_data) {
        // Handle send/recv socket data events
        const isSend = event.type === 'send';
        return {
            ...baseEvent,
            type: isSend ? 'SEND' : 'RECV',
            [isSend ? 'send' : 'recv']: {
                pid: event.socket_data.pid || 0,
                comm: '',
                fd: event.socket_data.fd || 0,
                bytes: event.socket_data.bytes || 0,
            },
        };
    }

    return baseEvent;
}

// Get job metrics endpoint - uses new v2.5.3 JobMetrics API
app.get('/api/jobs/:jobId/metrics', async (req, res) => {
    const {jobId} = req.params;
    let responseSent = false;

    try {
        console.log(`Getting metrics for job: ${jobId}`);

        // Check if the job is completed
        let jobStatus = null;
        try {
            const jobs = await grpcClient.listJobs();
            const job = jobs?.jobs?.find((j: any) => j.id === jobId || j.uuid === jobId);
            jobStatus = job?.status;
            console.log(`Job ${jobId} status: ${jobStatus}`);
        } catch (err) {
            console.warn(`Could not determine job status for ${jobId}:`, err);
        }

        const isCompleted = jobStatus === 'COMPLETED' || jobStatus === 'FAILED' || jobStatus === 'CANCELLED';

        try {
            const metrics: any[] = [];
            const stream = isCompleted
                ? grpcClient.getJobMetrics(jobId)
                : grpcClient.streamJobMetrics(jobId);

            stream.on('data', (event: any) => {
                // Debug: log raw metrics event (first only)
                if (metrics.length === 0) {
                    console.log('Raw metrics event sample:', JSON.stringify(event, null, 2));
                }
                metrics.push(transformMetricsEvent(event, jobId));
            });

            stream.on('end', () => {
                if (!responseSent) {
                    responseSent = true;
                    console.log(`Retrieved ${metrics.length} metrics for job: ${jobId}`);
                    res.json(metrics);
                }
            });

            stream.on('error', (error: any) => {
                if (!responseSent) {
                    responseSent = true;
                    console.error(`Failed to get metrics for ${jobId}:`, error);
                    res.json([]);
                }
            });
        } catch (error: any) {
            if (!responseSent) {
                responseSent = true;
                console.error(`Failed to stream metrics for ${jobId}:`, error);
                res.json([]);
            }
        }
    } catch (error) {
        if (!responseSent) {
            responseSent = true;
            console.error(`Failed to get metrics for ${jobId}:`, error);
            res.status(500).json({
                error: 'Failed to get job metrics',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
});

// Get job telematics endpoint - uses v2.5.4 JobTelematics API (eBPF events)
app.get('/api/jobs/:jobId/telematics', async (req, res) => {
    const {jobId} = req.params;
    const types = req.query.types ? (req.query.types as string).split(',') : [];
    let responseSent = false;

    try {
        console.log(`Getting telematics for job: ${jobId}, types: ${types.join(',') || 'all'}`);

        // Check if the job is completed
        let jobStatus = null;
        try {
            const jobs = await grpcClient.listJobs();
            const job = jobs?.jobs?.find((j: any) => j.id === jobId || j.uuid === jobId);
            jobStatus = job?.status;
        } catch (err) {
            console.warn(`Could not determine job status for ${jobId}:`, err);
        }

        const isCompleted = jobStatus === 'COMPLETED' || jobStatus === 'FAILED' || jobStatus === 'CANCELLED';

        try {
            const events: any[] = [];
            const stream = isCompleted
                ? grpcClient.getJobTelematics(jobId, types)
                : grpcClient.streamJobTelematics(jobId, types);

            stream.on('data', (event: any) => {
                // Debug: log raw telematics event (first only)
                if (events.length === 0) {
                    console.log('Raw telematics event sample:', JSON.stringify(event, null, 2));
                }
                events.push(transformTelematicsEvent(event, jobId));
            });

            stream.on('end', () => {
                if (!responseSent) {
                    responseSent = true;
                    console.log(`Retrieved ${events.length} telematics events for job: ${jobId}`);
                    res.json(events);
                }
            });

            stream.on('error', (error: any) => {
                if (!responseSent) {
                    responseSent = true;
                    console.error(`Failed to get telematics for ${jobId}:`, error);
                    res.json([]);
                }
            });
        } catch (error: any) {
            if (!responseSent) {
                responseSent = true;
                console.error(`Failed to stream telematics for ${jobId}:`, error);
                res.json([]);
            }
        }
    } catch (error) {
        if (!responseSent) {
            responseSent = true;
            console.error(`Failed to get telematics for ${jobId}:`, error);
            res.status(500).json({
                error: 'Failed to get job telematics',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
});

// Legacy telemetry endpoint - combines metrics + telematics for backwards compatibility
app.get('/api/jobs/:jobId/telemetry', async (req, res) => {
    const {jobId} = req.params;
    const types = req.query.types ? (req.query.types as string).split(',') : ['metrics'];
    let responseSent = false;

    try {
        console.log(`Getting telemetry (legacy) for job: ${jobId}, types: ${types.join(',')}`);

        // Redirect to appropriate endpoint based on types
        if (types.length === 1 && types[0] === 'metrics') {
            // Redirect to metrics endpoint
            return res.redirect(`/api/jobs/${jobId}/metrics`);
        } else if (!types.includes('metrics')) {
            // Redirect to telematics endpoint
            return res.redirect(`/api/jobs/${jobId}/telematics?types=${types.join(',')}`);
        }

        // If both metrics and telematics requested, fetch both
        let jobStatus = null;
        try {
            const jobs = await grpcClient.listJobs();
            const job = jobs?.jobs?.find((j: any) => j.id === jobId || j.uuid === jobId);
            jobStatus = job?.status;
        } catch (err) {
            console.warn(`Could not determine job status for ${jobId}:`, err);
        }

        const isCompleted = jobStatus === 'COMPLETED' || jobStatus === 'FAILED' || jobStatus === 'CANCELLED';
        const telemetry: any[] = [];
        let metricsComplete = false;
        let telematicsComplete = false;

        const checkComplete = () => {
            if (metricsComplete && telematicsComplete && !responseSent) {
                responseSent = true;
                // Sort by timestamp
                telemetry.sort((a, b) => a.timestamp - b.timestamp);
                console.log(`Retrieved ${telemetry.length} combined telemetry events for job: ${jobId}`);
                res.json(telemetry);
            }
        };

        // Fetch metrics
        const metricsStream = isCompleted
            ? grpcClient.getJobMetrics(jobId)
            : grpcClient.streamJobMetrics(jobId);

        metricsStream.on('data', (event: any) => {
            telemetry.push(transformMetricsEvent(event, jobId));
        });
        metricsStream.on('end', () => { metricsComplete = true; checkComplete(); });
        metricsStream.on('error', () => { metricsComplete = true; checkComplete(); });

        // Fetch telematics
        const telematicsTypes = types.filter(t => t !== 'metrics');
        const telematicsStream = isCompleted
            ? grpcClient.getJobTelematics(jobId, telematicsTypes)
            : grpcClient.streamJobTelematics(jobId, telematicsTypes);

        telematicsStream.on('data', (event: any) => {
            telemetry.push(transformTelematicsEvent(event, jobId));
        });
        telematicsStream.on('end', () => { telematicsComplete = true; checkComplete(); });
        telematicsStream.on('error', () => { telematicsComplete = true; checkComplete(); });

    } catch (error) {
        if (!responseSent) {
            responseSent = true;
            console.error(`Failed to get telemetry for ${jobId}:`, error);
            res.status(500).json({
                error: 'Failed to get job telemetry',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
});

// Execute job endpoint
app.post('/api/jobs/execute', async (req, res) => {
    try {
        console.log('Executing job with request:', req.body);
        const result = await grpcClient.runJob(req.body);
        res.json(result);
    } catch (error) {
        console.error('Failed to execute job:', error);
        res.status(500).json({
            error: 'Failed to execute job',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// System monitoring
app.get('/api/monitor', async (req, res) => {
    try {
        const result = await grpcClient.getSystemStatus();
        res.json(result);
    } catch (error) {
        console.error('Failed to get system status:', error);
        res.status(500).json({error: 'Failed to get system status'});
    }
});

// System info endpoint - detailed system information for monitoring page
app.get('/api/system-info', async (req, res) => {
    try {
        const status = await grpcClient.getSystemStatus();

        // Debug logging for network interfaces
        console.log('Network data from gRPC:', {
            networksCount: status.networks?.length || 0,
            sampleNetwork: status.networks?.[0],
            hostServerIPs: status.host?.serverIPs,
            hostMacAddresses: status.host?.macAddresses,
        });

        // Transform gRPC SystemStatusRes to DetailedSystemInfo format
        const systemInfo = {
            hostInfo: {
                hostname: status.host?.hostname,
                platform: status.host?.platform,
                arch: status.host?.architecture,
                release: status.host?.platformVersion,
                uptime: status.host?.uptime ? Number(status.host.uptime) : undefined,
                cloudProvider: status.cloud?.provider,
                instanceType: status.cloud?.instanceType,
                region: status.cloud?.region,
                nodeId: status.host?.nodeId,
                serverIPs: status.host?.serverIPs || [],
                macAddresses: status.host?.macAddresses || [],
                // Joblet server version info - try both camelCase and snake_case
                serverVersion: status.serverVersion?.version || status.server_version?.version,
                gitCommit: status.serverVersion?.gitCommit || status.serverVersion?.git_commit || status.server_version?.gitCommit || status.server_version?.git_commit,
                gitTag: status.serverVersion?.gitTag || status.serverVersion?.git_tag || status.server_version?.gitTag || status.server_version?.git_tag,
                buildDate: status.serverVersion?.buildDate || status.serverVersion?.build_date || status.server_version?.buildDate || status.server_version?.build_date,
                goVersion: status.serverVersion?.goVersion || status.serverVersion?.go_version || status.server_version?.goVersion || status.server_version?.go_version,
                serverPlatform: status.serverVersion?.platform || status.server_version?.platform,
            },
            cpuInfo: {
                cores: status.cpu?.cores,
                threads: status.host?.cpuCount,
                model: undefined, // Not provided in proto
                frequency: undefined, // Not provided in proto
                usage: status.cpu?.usagePercent,
                loadAverage: status.cpu?.loadAverage || [],
                perCoreUsage: status.cpu?.perCoreUsage || [],
                temperature: undefined, // Not provided in proto
            },
            memoryInfo: {
                total: status.memory?.totalBytes ? Number(status.memory.totalBytes) : undefined,
                used: status.memory?.usedBytes ? Number(status.memory.usedBytes) : undefined,
                available: status.memory?.availableBytes ? Number(status.memory.availableBytes) : undefined,
                percent: status.memory?.usagePercent,
                buffers: status.memory?.bufferedBytes ? Number(status.memory.bufferedBytes) : undefined,
                cached: status.memory?.cachedBytes ? Number(status.memory.cachedBytes) : undefined,
                swap: status.memory?.swapTotal ? {
                    total: Number(status.memory.swapTotal),
                    used: Number(status.memory.swapUsed || 0),
                    percent: status.memory.swapTotal > 0
                        ? (Number(status.memory.swapUsed || 0) / Number(status.memory.swapTotal)) * 100
                        : 0,
                } : undefined,
            },
            disksInfo: {
                disks: (status.disks || []).map((disk: any) => ({
                    name: disk.device || '',
                    mountpoint: disk.mountPoint || '',
                    filesystem: disk.filesystem || '',
                    size: Number(disk.totalBytes || 0),
                    used: Number(disk.usedBytes || 0),
                    available: Number(disk.freeBytes || 0),
                    percent: disk.usagePercent || 0,
                })),
                totalSpace: (status.disks || []).reduce((sum: number, disk: any) => sum + Number(disk.totalBytes || 0), 0),
                usedSpace: (status.disks || []).reduce((sum: number, disk: any) => sum + Number(disk.usedBytes || 0), 0),
            },
            networkInfo: {
                interfaces: (status.networks || []).map((net: any) => {
                    // Try both camelCase and snake_case for field names
                    const ipAddresses = net.ipAddresses || net.ip_addresses || [];
                    const macAddress = net.macAddress || net.mac_address || undefined;

                    return {
                        name: net.interface || '',
                        type: 'ethernet', // Not provided in proto
                        status: 'up', // Not provided in proto
                        speed: undefined,
                        mtu: undefined,
                        ipAddresses: ipAddresses,
                        macAddress: macAddress,
                        rxBytes: Number(net.bytesReceived || net.bytes_received || 0),
                        txBytes: Number(net.bytesSent || net.bytes_sent || 0),
                        rxPackets: Number(net.packetsReceived || net.packets_received || 0),
                        txPackets: Number(net.packetsSent || net.packets_sent || 0),
                        rxErrors: Number(net.errorsIn || net.errors_in || 0),
                        txErrors: Number(net.errorsOut || net.errors_out || 0),
                    };
                }),
                totalRxBytes: (status.networks || []).reduce((sum: number, net: any) => sum + Number(net.bytesReceived || net.bytes_received || 0), 0),
                totalTxBytes: (status.networks || []).reduce((sum: number, net: any) => sum + Number(net.bytesSent || net.bytes_sent || 0), 0),
                // Add server-level IP and MAC info from HostInfo (try both camelCase and snake_case)
                serverIPs: status.host?.serverIPs || status.host?.server_ips || [],
                macAddresses: status.host?.macAddresses || status.host?.mac_addresses || [],
            },
            processesInfo: {
                processes: [
                    ...(status.processes?.topByCPU || []).map((proc: any) => ({
                        pid: proc.pid || 0,
                        name: proc.name || '',
                        command: proc.command || '',
                        user: 'unknown', // Not provided in proto
                        cpu: proc.cpuPercent || 0,
                        memory: proc.memoryPercent || 0,
                        memoryBytes: Number(proc.memoryBytes || 0),
                        status: proc.status || '',
                        startTime: proc.startTime,
                    })),
                ],
                totalProcesses: status.processes?.totalProcesses,
                runningProcesses: status.processes?.runningProcesses,
                sleepingProcesses: status.processes?.sleepingProcesses,
            },
        };

        res.json(systemInfo);
    } catch (error) {
        console.error('Failed to get system info:', error);
        res.status(500).json({error: 'Failed to get system info'});
    }
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket setup
const wss = new WebSocketServer({
    noServer: true
});

// Handle WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url!, `http://${req.headers.host}`).pathname;

    if (pathname === '/ws' || pathname === '/ws/monitor' || pathname.startsWith('/ws/logs/') || pathname.startsWith('/ws/metrics/') || pathname.startsWith('/ws/telematics/') || pathname.startsWith('/ws/telemetry/') || pathname.startsWith('/ws/runtime-build/')) {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    } else {
        socket.destroy();
    }
});

wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/ws/monitor') {
        // Handle monitor stream
        const node = url.searchParams.get('node') || 'default';
        console.log(`Monitor stream connected for node: ${node}`);

        // Set the node on gRPC client
        grpcClient.setNode(node);

        // Send initial connection message
        ws.send(JSON.stringify({
            type: 'connected',
            node: node,
            timestamp: new Date().toISOString()
        }));

        try {
            // Stream system metrics from gRPC
            const stream = grpcClient.getSystemMetricsStream();

            stream.on('data', (metrics: any) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'metrics',
                        data: metrics,
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('end', () => {
                console.log('Monitor stream ended');
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'end',
                        message: 'Metrics stream ended',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('error', (error: any) => {
                console.error('Monitor stream error:', error);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: error.details || error.message || 'Failed to stream system metrics',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            ws.on('close', () => {
                console.log('Monitor stream disconnected');
                try {
                    stream.cancel();
                } catch (error) {
                    // Ignore errors when canceling stream
                }
            });
        } catch (error) {
            console.error('Failed to create monitor stream:', error);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to create monitor stream',
                    timestamp: new Date().toISOString()
                }));
            }
        }
    } else if (pathname.startsWith('/ws/logs/')) {
        // Handle log stream
        const jobId = pathname.split('/ws/logs/')[1]?.split('?')[0];
        const node = url.searchParams.get('node') || 'default';
        console.log(`Log stream connected for job: ${jobId}, node: ${node}`);

        // Set the node on gRPC client
        grpcClient.setNode(node);

        // Send initial connection message
        ws.send(JSON.stringify({
            type: 'connection',
            message: `Connected to logs for job ${jobId}`,
            timestamp: new Date().toISOString()
        }));

        try {
            // Stream logs from gRPC
            const stream = grpcClient.getJobLogs(jobId);
            let hasReceivedData = false;

            stream.on('data', (chunk: any) => {
                hasReceivedData = true;
                // Check both 'content' and 'payload' for compatibility
                const logData = chunk.content || chunk.payload;
                if (ws.readyState === ws.OPEN && logData) {
                    const logLine = Buffer.from(logData).toString('utf-8');
                    ws.send(JSON.stringify({
                        type: 'log',
                        data: logLine,
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('end', () => {
                if (ws.readyState === ws.OPEN) {
                    if (!hasReceivedData) {
                        // No logs received - job might not have any logs or they're not available via streaming
                        ws.send(JSON.stringify({
                            type: 'info',
                            message: 'No logs available for this job. The job may not have generated any output or logs may not be accessible.',
                            timestamp: new Date().toISOString()
                        }));
                    }
                    ws.send(JSON.stringify({
                        type: 'end',
                        message: 'Log stream ended',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('error', (error: any) => {
                console.error(`Log stream error for job ${jobId}:`, error);
                if (ws.readyState === ws.OPEN) {
                    // Provide more helpful error message
                    const errorMessage = error.code === 5
                        ? 'Job not found or logs not available'
                        : error.message || 'Failed to stream logs';

                    ws.send(JSON.stringify({
                        type: 'error',
                        message: errorMessage,
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            ws.on('close', () => {
                console.log(`Log stream disconnected for job: ${jobId}`);
                stream.cancel();
            });
        } catch (error) {
            console.error(`Failed to create log stream for job ${jobId}:`, error);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to create log stream',
                    timestamp: new Date().toISOString()
                }));
            }
        }
    } else if (pathname.startsWith('/ws/metrics/')) {
        // Handle metrics-only stream (cgroups data) - v2.5.3 API
        const jobId = pathname.split('/ws/metrics/')[1]?.split('?')[0];
        const node = url.searchParams.get('node') || 'default';
        console.log(`Metrics stream connected for job: ${jobId}, node: ${node}`);

        grpcClient.setNode(node);

        ws.send(JSON.stringify({
            type: 'connection',
            message: `Connected to metrics for job ${jobId}`,
            timestamp: new Date().toISOString()
        }));

        try {
            const stream = grpcClient.streamJobMetrics(jobId);
            let hasReceivedData = false;

            stream.on('data', (event: any) => {
                hasReceivedData = true;
                if (ws.readyState === ws.OPEN) {
                    const transformedData = transformMetricsEvent(event, jobId);
                    ws.send(JSON.stringify({
                        type: 'metrics',
                        data: transformedData,
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('end', () => {
                console.log(`Metrics stream ended for job: ${jobId}`);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'end',
                        message: hasReceivedData
                            ? 'Metrics stream ended'
                            : 'No metrics available for this job',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('error', (error: any) => {
                console.error(`Metrics stream error for job ${jobId}:`, error);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: error.details || error.message || 'Failed to stream metrics',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            ws.on('close', () => {
                console.log(`Metrics stream disconnected for job: ${jobId}`);
                try { stream.cancel(); } catch (e) { /* ignore */ }
            });
        } catch (error) {
            console.error(`Failed to create metrics stream for job ${jobId}:`, error);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to create metrics stream',
                    timestamp: new Date().toISOString()
                }));
            }
        }
    } else if (pathname.startsWith('/ws/telematics/')) {
        // Handle telematics-only stream (eBPF events) - v2.5.4 API
        const jobId = pathname.split('/ws/telematics/')[1]?.split('?')[0];
        const node = url.searchParams.get('node') || 'default';
        const types = url.searchParams.get('types')?.split(',') || [];
        console.log(`Telematics stream connected for job: ${jobId}, node: ${node}, types: ${types.join(',') || 'all'}`);

        grpcClient.setNode(node);

        ws.send(JSON.stringify({
            type: 'connection',
            message: `Connected to telematics for job ${jobId}`,
            timestamp: new Date().toISOString()
        }));

        try {
            const stream = grpcClient.streamJobTelematics(jobId, types);
            let hasReceivedData = false;

            stream.on('data', (event: any) => {
                hasReceivedData = true;
                if (ws.readyState === ws.OPEN) {
                    const transformedData = transformTelematicsEvent(event, jobId);
                    ws.send(JSON.stringify({
                        type: 'telematics',
                        data: transformedData,
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('end', () => {
                console.log(`Telematics stream ended for job: ${jobId}`);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'end',
                        message: hasReceivedData
                            ? 'Telematics stream ended'
                            : 'No telematics events available for this job',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            stream.on('error', (error: any) => {
                console.error(`Telematics stream error for job ${jobId}:`, error);
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: error.details || error.message || 'Failed to stream telematics',
                        timestamp: new Date().toISOString()
                    }));
                }
            });

            ws.on('close', () => {
                console.log(`Telematics stream disconnected for job: ${jobId}`);
                try { stream.cancel(); } catch (e) { /* ignore */ }
            });
        } catch (error) {
            console.error(`Failed to create telematics stream for job ${jobId}:`, error);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to create telematics stream',
                    timestamp: new Date().toISOString()
                }));
            }
        }
    } else if (pathname.startsWith('/ws/telemetry/')) {
        // Handle combined telemetry stream (metrics + telematics) - v2.5.4 API
        const jobId = pathname.split('/ws/telemetry/')[1]?.split('?')[0];
        const node = url.searchParams.get('node') || 'default';
        const types = url.searchParams.get('types')?.split(',') || [];
        const wantMetrics = types.length === 0 || types.includes('metrics');
        const telematicsTypes = types.filter(t => t !== 'metrics');
        console.log(`Telemetry stream connected for job: ${jobId}, node: ${node}, types: ${types.join(',') || 'all'}`);

        grpcClient.setNode(node);

        ws.send(JSON.stringify({
            type: 'connection',
            message: `Connected to telemetry for job ${jobId}`,
            timestamp: new Date().toISOString()
        }));

        try {
            const streams: any[] = [];
            let hasReceivedData = false;
            let streamsEnded = 0;
            let totalStreams = 0;

            // Start metrics stream if requested
            if (wantMetrics) {
                totalStreams++;
                const metricsStream = grpcClient.streamJobMetrics(jobId);
                streams.push(metricsStream);

                metricsStream.on('data', (event: any) => {
                    hasReceivedData = true;
                    if (ws.readyState === ws.OPEN) {
                        const transformedData = transformMetricsEvent(event, jobId);
                        ws.send(JSON.stringify({
                            type: 'telemetry',
                            data: transformedData,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });

                metricsStream.on('end', () => {
                    streamsEnded++;
                    checkAllEnded();
                });

                metricsStream.on('error', (error: any) => {
                    console.error(`Metrics stream error for job ${jobId}:`, error);
                });
            }

            // Start telematics stream if types other than metrics are requested
            if (telematicsTypes.length > 0 || types.length === 0) {
                totalStreams++;
                const telematicsStream = grpcClient.streamJobTelematics(jobId, telematicsTypes);
                streams.push(telematicsStream);

                telematicsStream.on('data', (event: any) => {
                    hasReceivedData = true;
                    if (ws.readyState === ws.OPEN) {
                        const transformedData = transformTelematicsEvent(event, jobId);
                        ws.send(JSON.stringify({
                            type: 'telemetry',
                            data: transformedData,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });

                telematicsStream.on('end', () => {
                    streamsEnded++;
                    checkAllEnded();
                });

                telematicsStream.on('error', (error: any) => {
                    console.error(`Telematics stream error for job ${jobId}:`, error);
                });
            }

            function checkAllEnded() {
                if (streamsEnded >= totalStreams) {
                    console.log(`Telemetry stream ended for job: ${jobId}`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'end',
                            message: hasReceivedData
                                ? 'Telemetry stream ended'
                                : 'No telemetry available for this job',
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            }

            ws.on('close', () => {
                console.log(`Telemetry stream disconnected for job: ${jobId}`);
                streams.forEach(stream => {
                    try { stream.cancel(); } catch (e) { /* ignore */ }
                });
            });
        } catch (error) {
            console.error(`Failed to create telemetry stream for job ${jobId}:`, error);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to create telemetry stream',
                    timestamp: new Date().toISOString()
                }));
            }
        }
    } else if (pathname.startsWith('/ws/runtime-build/')) {
        // Handle runtime build stream (YAML-based)
        const sessionId = pathname.split('/ws/runtime-build/')[1]?.split('?')[0];
        console.log(`Runtime build stream connected for session: ${sessionId}`);

        const sessionData = runtimeBuildStreams.get(sessionId);

        if (!sessionData) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Build session not found or expired',
                timestamp: new Date().toISOString()
            }));
            ws.close();
            return;
        }

        // Send connection confirmation
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to build stream',
            timestamp: new Date().toISOString()
        }));

        // Send all existing logs
        sessionData.logs.forEach((log: any) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(log));
            }
        });

        // If build is already completed, send completion and close
        if (sessionData.completed) {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'end',
                    message: 'Build stream ended',
                    timestamp: new Date().toISOString()
                }));
            }
            return;
        }

        // Set up polling to send new logs
        const pollInterval = setInterval(() => {
            const currentSessionData = runtimeBuildStreams.get(sessionId);
            if (!currentSessionData) {
                clearInterval(pollInterval);
                return;
            }

            // Send any new logs that have been added since last poll
            const sentCount = sessionData.sentCount || 0;
            const newLogs = currentSessionData.logs.slice(sentCount);

            newLogs.forEach((log: any) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify(log));
                }
            });

            sessionData.sentCount = currentSessionData.logs.length;

            // If completed, send end message and stop polling
            if (currentSessionData.completed) {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'end',
                        message: 'Build stream ended',
                        timestamp: new Date().toISOString()
                    }));
                }
                clearInterval(pollInterval);
            }
        }, 500);

        ws.on('close', () => {
            console.log(`Runtime build stream disconnected for session: ${sessionId}`);
            clearInterval(pollInterval);
        });
    }
});

// Start server
server.listen(port, () => {
    console.log(`🚀 Joblet Admin Server running at http://${host}:${port}`);
    console.log(`📡 API endpoints available at /api/*`);
    console.log(`🔍 Health check at /health`);
    console.log(`🧪 gRPC test at /api/test`);
    console.log(`🔗 WebSocket available at ws://${host}:${port}/ws`);
});

export default app;