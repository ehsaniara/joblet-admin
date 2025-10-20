import express from 'express';
import cors from 'cors';
import http from 'http';
import {WebSocketServer} from 'ws';
import {grpcClient} from '../grpc/client.js';

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

// Registry runtimes endpoint - fetches from runtime registry
app.get('/api/registry/runtimes', async (req, res) => {
    try {
        // Default registry URL - can be overridden via query parameter
        const registryUrl = req.query.registry as string ||
            'https://raw.githubusercontent.com/ehsaniara/joblet-runtimes/main/registry.json';

        console.log(`Fetching runtime registry from: ${registryUrl}`);

        const registryResponse = await fetch(registryUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Joblet-Admin'
            }
        });

        if (!registryResponse.ok) {
            if (registryResponse.status === 404) {
                return res.status(404).json({
                    error: 'Runtime registry not found',
                    message: 'registry.json not found at the specified URL'
                });
            }
            if (registryResponse.status === 403) {
                return res.status(403).json({
                    error: 'Access forbidden',
                    message: 'Unable to access the runtime registry'
                });
            }
            throw new Error(`Registry fetch error: ${registryResponse.status}`);
        }

        const registry = await registryResponse.json();

        // Process runtimes from registry
        // Registry structure: { version, updated_at, runtimes: { "runtime-name": { "version": {...} } } }
        const runtimesObj = registry.runtimes || {};
        const runtimes: any[] = [];

        // Convert nested structure to flat array with all versions
        Object.entries(runtimesObj).forEach(([runtimeName, versions]: [string, any]) => {
            // Get all versions for this runtime
            const versionEntries = Object.entries(versions);

            // Sort versions to find latest
            const sortedVersions = versionEntries.sort((a, b) => {
                // Simple version comparison (works for semver)
                return b[0].localeCompare(a[0]);
            });

            // Process each version
            versionEntries.forEach(([version, versionData]: [string, any]) => {
                const isLatest = version === sortedVersions[0][0];

                runtimes.push({
                    name: runtimeName,
                    version: version,
                    versionTag: isLatest ? 'latest' : version,
                    fullSpec: `${runtimeName}@${version}`,
                    displayName: versionData.description || runtimeName,
                    description: versionData.description || '',
                    platforms: versionData.platforms || [],
                    size: versionData.size ? `${(versionData.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
                    type: 'registry',
                    downloadUrl: versionData.download_url || '',
                    checksum: versionData.checksum || '',
                    isLatest: isLatest
                });
            });
        });

        res.json(runtimes);
    } catch (error) {
        console.error('Failed to fetch runtime registry:', error);
        res.status(500).json({
            error: 'Failed to fetch runtimes from registry',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Legacy GitHub runtimes endpoint - kept for backwards compatibility
app.get('/api/github/runtimes', async (req, res) => {
    try {
        // Redirect to registry endpoint with default registry
        const registryUrl = 'https://raw.githubusercontent.com/ehsaniara/joblet-runtimes/main/registry.json';

        console.log(`Legacy endpoint called, redirecting to registry: ${registryUrl}`);

        const registryResponse = await fetch(registryUrl);
        if (!registryResponse.ok) {
            throw new Error(`Registry fetch error: ${registryResponse.status}`);
        }

        const registry = await registryResponse.json();
        const runtimesObj = registry.runtimes || {};
        const runtimes: any[] = [];

        Object.entries(runtimesObj).forEach(([runtimeName, versions]: [string, any]) => {
            const versionEntries = Object.entries(versions);
            const sortedVersions = versionEntries.sort((a, b) => b[0].localeCompare(a[0]));

            versionEntries.forEach(([version, versionData]: [string, any]) => {
                const isLatest = version === sortedVersions[0][0];

                runtimes.push({
                    name: runtimeName,
                    version: version,
                    fullSpec: `${runtimeName}@${version}`,
                    displayName: versionData.description || runtimeName,
                    language: runtimeName.split('-')[0],
                    description: versionData.description || '',
                    platforms: versionData.platforms || [],
                    size: versionData.size ? `${(versionData.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
                    type: 'registry',
                    isLatest: isLatest
                });
            });
        });

        res.json(runtimes);
    } catch (error) {
        console.error('Failed to fetch GitHub runtimes:', error);
        res.status(500).json({
            error: 'Failed to fetch runtimes from registry',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Active runtime installation streams
const runtimeInstallStreams = new Map<string, any>();

// Runtime installation endpoint
app.post('/api/runtimes/install', async (req, res) => {
    try {
        const {name, force, version} = req.body;

        if (!name) {
            return res.status(400).json({error: 'Runtime name is required'});
        }

        // Determine if this is a registry-based install or GitHub-based install
        // Registry mode: runtimeSpec includes @version or uses @latest, and no repository specified
        // GitHub mode: repository/branch/path are provided
        const isRegistryInstall = !req.body.repository || version;

        let runtimeSpec = name;
        let repository = '';
        let branch = '';
        let path = '';

        if (isRegistryInstall) {
            // Registry-based installation
            // Format: runtime-name@version or runtime-name@latest
            if (version && !name.includes('@')) {
                runtimeSpec = `${name}@${version}`;
            } else if (!name.includes('@')) {
                // No version specified, use @latest
                runtimeSpec = `${name}@latest`;
            }
            // Leave repository/branch/path empty to trigger registry mode on server
            console.log(`Installing runtime from registry: ${runtimeSpec}`);
        } else {
            // Legacy GitHub-based installation
            repository = req.body.repository || 'ehsaniara/joblet';
            branch = req.body.branch || 'main';
            path = req.body.path || 'runtimes';
            console.log(`Installing runtime from GitHub: ${runtimeSpec} from ${repository}/${branch}/${path}`);
        }

        // Generate a unique session ID for this installation
        const sessionId = `${runtimeSpec}-${Date.now()}`;

        // Create install request
        const installRequest = {
            runtimeSpec: runtimeSpec,
            repository: repository,
            branch: branch,
            path: path,
            forceReinstall: force || false
        };

        console.log(`Installing runtime: ${runtimeSpec} (session: ${sessionId}, mode: ${isRegistryInstall ? 'registry' : 'github'})`);

        // Create session entry BEFORE sending response to avoid race condition
        runtimeInstallStreams.set(sessionId, {logs: [], completed: false, sentCount: 0});

        // Return immediately with session ID so client can connect to WebSocket
        res.json({
            sessionId: sessionId,
            message: 'Installation started. Connect to WebSocket for progress.',
            runtimeSpec: name
        });

        // Start the streaming install after response is sent
        setImmediate(() => {
            const stream = grpcClient.streamingInstallRuntimeFromGithub(installRequest);
            const sessionData = runtimeInstallStreams.get(sessionId);
            if (sessionData) {
                sessionData.stream = stream;
            }

            stream.on('data', (chunk: any) => {
                const sessionData = runtimeInstallStreams.get(sessionId);
                if (!sessionData) return;

                // Handle different chunk types
                if (chunk.result) {
                    const buildJobId = chunk.result.buildJobUuid || '';
                    console.log(`Runtime installation job started: ${buildJobId}`);
                    sessionData.logs.push({
                        type: 'result',
                        message: `Installation job started: ${buildJobId}`,
                        timestamp: new Date().toISOString(),
                        data: chunk.result
                    });
                } else if (chunk.progress) {
                    console.log(`Progress: ${chunk.progress.message} (${chunk.progress.step}/${chunk.progress.total_steps})`);
                    sessionData.logs.push({
                        type: 'progress',
                        message: chunk.progress.message,
                        step: chunk.progress.step,
                        totalSteps: chunk.progress.total_steps,
                        timestamp: new Date().toISOString()
                    });
                } else if (chunk.log) {
                    const logData = Buffer.from(chunk.log.data).toString('utf-8');
                    console.log(`Log: ${logData}`);
                    sessionData.logs.push({
                        type: 'log',
                        message: logData,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            stream.on('end', () => {
                const sessionData = runtimeInstallStreams.get(sessionId);
                if (sessionData) {
                    sessionData.completed = true;
                    sessionData.logs.push({
                        type: 'complete',
                        message: 'Installation completed successfully',
                        timestamp: new Date().toISOString()
                    });
                    console.log(`Runtime installation completed: ${sessionId}`);
                    // Keep session data for 30 seconds for late WebSocket connections
                    setTimeout(() => runtimeInstallStreams.delete(sessionId), 30000);
                }
            });

            stream.on('error', (error: any) => {
                console.error(`Runtime installation error:`, error);
                const sessionData = runtimeInstallStreams.get(sessionId);
                if (sessionData) {
                    sessionData.completed = true;
                    sessionData.error = error.details || error.message || 'Unknown error';
                    sessionData.logs.push({
                        type: 'error',
                        message: error.details || error.message || 'Unknown error',
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });
    } catch (error) {
        console.error('Failed to install runtime:', error);
        res.status(500).json({
            error: 'Failed to install runtime',
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

// Get job metrics endpoint - fetches metrics from job service
app.get('/api/jobs/:jobId/metrics', async (req, res) => {
    const {jobId} = req.params;
    let responseSent = false; // Track if response was already sent

    try {
        console.log(`Getting metrics for job: ${jobId}`);

        // First, check if the job is completed
        let jobStatus = null;
        try {
            const jobs = await grpcClient.listJobs();
            const job = jobs?.jobs?.find((j: any) => j.id === jobId || j.uuid === jobId);
            jobStatus = job?.status;
            console.log(`Job ${jobId} status: ${jobStatus}`);
        } catch (err) {
            console.warn(`Could not determine job status for ${jobId}:`, err);
            // Continue anyway, try to get metrics
        }

        // For completed/failed jobs, metrics are typically not available anymore
        // unless a persist service is configured
        if (jobStatus === 'COMPLETED' || jobStatus === 'FAILED' || jobStatus === 'CANCELLED') {
            console.log(`Job ${jobId} is ${jobStatus}. Metrics are not retained after job completion.`);
            console.log(`Note: Historical metrics require a separate persist service to be configured.`);
            // Return empty array - the UI will show an appropriate message
            return res.json([]);
        }

        try {
            const metrics: any[] = [];
            const stream = grpcClient.streamJobMetrics(jobId);

            stream.on('data', (metric: any) => {
                // Handle the new protobuf structure (JobMetricsSample)
                if (metric.cpu || metric.memory || metric.io) {
                    metrics.push({
                        jobId: metric.jobId || jobId,
                        timestamp: metric.timestamp ? Number(metric.timestamp) : Date.now() / 1000,
                        sampleIntervalSeconds: metric.sampleIntervalSeconds || 5,
                        cpu: {
                            usage: metric.cpu?.usagePercent || 0,
                            usagePercent: metric.cpu?.usagePercent || 0,
                        },
                        memory: {
                            current: metric.memory?.current || 0,
                            limit: metric.memory?.max || 0,
                        },
                        io: {
                            readBytes: metric.io?.totalReadBytes || 0,
                            writeBytes: metric.io?.totalWriteBytes || 0,
                            totalReadBytes: metric.io?.totalReadBytes || 0,
                            totalWriteBytes: metric.io?.totalWriteBytes || 0,
                        },
                        network: {
                            rxBytes: metric.network?.totalRxBytes || 0,
                            txBytes: metric.network?.totalTxBytes || 0,
                        },
                        process: metric.process || {},
                        limits: metric.limits || {},
                    });
                }
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

                    // Return empty array - the UI will show an appropriate message
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

    if (pathname === '/ws' || pathname === '/ws/monitor' || pathname.startsWith('/ws/logs/') || pathname.startsWith('/ws/metrics/') || pathname.startsWith('/ws/runtime-install/')) {
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
        // Handle metrics stream
        const jobId = pathname.split('/ws/metrics/')[1]?.split('?')[0];
        const node = url.searchParams.get('node') || 'default';
        console.log(`Metrics stream connected for job: ${jobId}, node: ${node}`);

        // Set the node on gRPC client
        grpcClient.setNode(node);

        // Send initial connection message
        ws.send(JSON.stringify({
            type: 'connection',
            message: `Connected to metrics for job ${jobId}`,
            timestamp: new Date().toISOString()
        }));

        try {
            const stream = grpcClient.streamJobMetrics(jobId);
            let hasReceivedData = false;

            stream.on('data', (sample: any) => {
                hasReceivedData = true;
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'metrics',
                        data: sample,
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
                            : 'No metrics available for this job (metrics collection may not be enabled)',
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
                try {
                    stream.cancel();
                } catch (error) {
                    // Ignore errors when canceling stream
                }
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
    } else if (pathname.startsWith('/ws/runtime-install/')) {
        // Handle runtime installation stream
        const sessionId = pathname.split('/ws/runtime-install/')[1]?.split('?')[0];
        console.log(`Runtime installation stream connected for session: ${sessionId}`);

        const sessionData = runtimeInstallStreams.get(sessionId);

        if (!sessionData) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Installation session not found or expired',
                timestamp: new Date().toISOString()
            }));
            ws.close();
            return;
        }

        // Send connection confirmation
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to installation stream',
            timestamp: new Date().toISOString()
        }));

        // Send all existing logs
        sessionData.logs.forEach((log: any) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(log));
            }
        });

        // If installation is already completed, send completion and close
        if (sessionData.completed) {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: 'end',
                    message: 'Installation stream ended',
                    timestamp: new Date().toISOString()
                }));
            }
            return;
        }

        // Set up polling to send new logs
        const pollInterval = setInterval(() => {
            const currentSessionData = runtimeInstallStreams.get(sessionId);
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
                        message: 'Installation stream ended',
                        timestamp: new Date().toISOString()
                    }));
                }
                clearInterval(pollInterval);
            }
        }, 500);

        ws.on('close', () => {
            console.log(`Runtime installation stream disconnected for session: ${sessionId}`);
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