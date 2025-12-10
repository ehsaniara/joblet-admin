import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {Job} from '../../types/job';
import {useLogStream} from '../../hooks/useLogStream';
import {apiService} from '../../services/apiService';
import {JobMetrics} from '../JobMetrics/JobMetrics';
import {JobActivity} from '../JobActivity/JobActivity';
import {useDateFormatter} from '../../hooks/useDateFormatter';

interface JobDetailProps {
    jobId: string;
    onClose: () => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({
                                                        jobId,
                                                        onClose,
                                                    }) => {
    const {formatDateTime} = useDateFormatter();
    const [activeTab, setActiveTab] = useState<'logs' | 'details' | 'metrics' | 'telematics'>('logs');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [jobLoading, setJobLoading] = useState<boolean>(false);
    const [autoScroll, setAutoScroll] = useState<boolean>(true);
    const logsContainerRef = useRef<HTMLDivElement>(null);

    const {logs, connected, error: logError, clearLogs} = useLogStream(jobId);

    useEffect(() => {
        if (jobId) {
            void fetchJobDetails();
        }
    }, [jobId]);

    useEffect(() => {
        if (autoScroll && logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const fetchJobDetails = async () => {
        setJobLoading(true);
        try {
            const jobData = await apiService.getJobStatus(jobId);
            setSelectedJob(jobData);
        } catch (error) {
            console.error('Failed to fetch job details:', error);
        } finally {
            setJobLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING':
                return 'bg-yellow-100 text-yellow-800';
            case 'COMPLETED':
                return 'bg-green-100 text-green-800';
            case 'FAILED':
                return 'bg-red-100 text-red-800';
            case 'STOPPED':
                return 'bg-gray-100 text-gray-800';
            case 'QUEUED':
                return 'bg-blue-100 text-blue-800';
            case 'SCHEDULED':
                return 'bg-purple-100 text-purple-800';
            case 'CANCELLED':
            case 'CANCELED':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const generateRnxCommand = (job: Job): string => {
        // Helper to escape shell special characters in a value
        const shellEscape = (str: string): string => {
            // If the string contains special characters, wrap in single quotes
            // and escape any single quotes within by ending quote, adding escaped quote, starting quote again
            if (/[^a-zA-Z0-9_\-.,/:=@]/.test(str)) {
                return "'" + str.replace(/'/g, "'\\''") + "'";
            }
            return str;
        };

        const parts: string[] = ['rnx job run'];

        // Add runtime (flags must come before the command)
        if (job.runtime) {
            parts.push(`--runtime=${shellEscape(job.runtime)}`);
        }

        // Add CPU limits (correct flag: --max-cpu)
        if (job.maxCPU !== undefined && job.maxCPU > 0) {
            parts.push(`--max-cpu=${job.maxCPU}`);
        }

        // Add CPU cores
        if (job.cpuCores) {
            parts.push(`--cpu-cores=${job.cpuCores}`);
        }

        // Add memory limit (correct flag: --max-memory)
        if (job.maxMemory !== undefined && job.maxMemory > 0) {
            parts.push(`--max-memory=${job.maxMemory}`);
        }

        // Add IO limit (correct flag: --max-iobps)
        if (job.maxIOBPS !== undefined && job.maxIOBPS > 0) {
            parts.push(`--max-iobps=${job.maxIOBPS}`);
        }

        // Add GPU settings
        if (job.gpuCount !== undefined && job.gpuCount > 0) {
            parts.push(`--gpu=${job.gpuCount}`);
        }

        if (job.gpuMemoryMb !== undefined && job.gpuMemoryMb > 0) {
            parts.push(`--gpu-memory=${job.gpuMemoryMb}MB`);
        }

        // Add network
        if (job.network) {
            parts.push(`--network=${shellEscape(job.network)}`);
        }

        // Add volumes
        if (job.volumes && job.volumes.length > 0) {
            job.volumes.forEach(volume => {
                parts.push(`--volume=${shellEscape(volume)}`);
            });
        }

        // Add uploads (files)
        if (job.uploads && job.uploads.length > 0) {
            job.uploads.forEach(file => {
                parts.push(`--upload=${shellEscape(file)}`);
            });
        }

        // Add upload directories
        if (job.uploadDirs && job.uploadDirs.length > 0) {
            job.uploadDirs.forEach(dir => {
                parts.push(`--upload-dir=${shellEscape(dir)}`);
            });
        }

        // Add environment variables (use --env or -e)
        if (job.envVars && Object.keys(job.envVars).length > 0) {
            Object.entries(job.envVars).forEach(([key, value]) => {
                parts.push(`-e ${key}=${shellEscape(value)}`);
            });
        }

        // Add secret environment variables (use --secret-env or -s)
        if (job.secretEnvVars && Object.keys(job.secretEnvVars).length > 0) {
            Object.entries(job.secretEnvVars).forEach(([key, value]) => {
                parts.push(`-s ${key}=${shellEscape(value)}`);
            });
        }

        // Add scheduled time
        if (job.scheduledTime) {
            parts.push(`--schedule=${shellEscape(job.scheduledTime)}`);
        }

        // Add command (must come after all flags)
        if (job.command) {
            parts.push(shellEscape(job.command));
        }

        // Add args (each arg quoted separately if needed)
        if (job.args && job.args.length > 0) {
            job.args.forEach(arg => {
                parts.push(shellEscape(arg));
            });
        }

        // Join all parts with spaces
        return parts.join(' ');
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Could add a toast notification here
            console.log('Command copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div
                className="relative top-16 mx-auto p-5 border w-11/12 max-w-[90vw] min-h-[80vh] shadow-lg rounded-md bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between pb-3 border-b">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Job Details - {jobId}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X className="h-5 w-5"/>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200 dark:border-gray-600">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'logs'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            Logs
                        </button>
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'details'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveTab('metrics')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'metrics'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            Metrics
                        </button>
                        <button
                            onClick={() => setActiveTab('telematics')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'telematics'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            Telematics
                        </button>
                    </nav>
                </div>

                <div className="py-4">
                    {/* Logs Tab */}
                    {activeTab === 'logs' && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {connected ? 'Connected' : 'Disconnected'}
                                        </span>
                                    </div>
                                    <label
                                        className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                        <input
                                            type="checkbox"
                                            checked={autoScroll}
                                            onChange={(e) => setAutoScroll(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>Auto-scroll</span>
                                    </label>
                                </div>
                                <button
                                    onClick={clearLogs}
                                    className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded"
                                >
                                    Clear Logs
                                </button>
                            </div>

                            {logError && (
                                <div
                                    className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
                                    Error: {logError}
                                </div>
                            )}

                            <div
                                ref={logsContainerRef}
                                className="bg-black text-green-400 p-4 rounded-lg h-[70vh] overflow-y-auto font-mono text-sm"
                            >
                                {logs.length === 0 ? (
                                    <div className="text-gray-500">
                                        No logs available yet...
                                    </div>
                                ) : (
                                    logs.map((log, index) => (
                                        <div key={index} className={`mb-1 whitespace-pre-wrap ${
                                            log.type === 'system' ? 'text-gray-400 opacity-80' :
                                                log.type === 'info' ? 'text-gray-200' :
                                                    log.type === 'error' ? 'text-red-400' :
                                                        log.type === 'connection' ? 'text-blue-400' :
                                                            'text-green-400'
                                        }`}>
                                            {log.message}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {/* Details Tab */}
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            {jobLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    <span
                                        className="ml-3 text-gray-600 dark:text-gray-400">Loading job details...</span>
                                </div>
                            ) : selectedJob ? (
                                <>
                                    {/* Basic Information */}
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
                                        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Job
                                                    ID
                                                </dt>
                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{selectedJob.id}</dd>
                                            </div>
                                            {selectedJob.name && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Job
                                                        Name
                                                    </dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.name}</dd>
                                                </div>
                                            )}
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                                                <dd className="mt-1">
                                                    <span
                                                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedJob.status)}`}>
                                                        {selectedJob.status}
                                                    </span>
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Command</dt>
                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                                                    {selectedJob.command} {selectedJob.args?.join(' ')}
                                                </dd>
                                            </div>
                                            {selectedJob.runtime && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Runtime</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.runtime}</dd>
                                                </div>
                                            )}
                                            {selectedJob.network && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Network</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.network}</dd>
                                                </div>
                                            )}
                                            {selectedJob.nodeId && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Node
                                                        ID
                                                    </dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{selectedJob.nodeId}</dd>
                                                </div>
                                            )}
                                            {selectedJob.startTime && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Start
                                                        Time
                                                    </dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(selectedJob.startTime)}</dd>
                                                </div>
                                            )}
                                            {selectedJob.endTime && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">End
                                                        Time
                                                    </dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(selectedJob.endTime)}</dd>
                                                </div>
                                            )}
                                            {selectedJob.duration !== undefined && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.duration}s</dd>
                                                </div>
                                            )}
                                            {selectedJob.exitCode !== undefined && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Exit
                                                        Code
                                                    </dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.exitCode}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    </div>

                                    {/* RNX Command Preview */}
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white">RNX
                                                Command Preview</h4>
                                            <button
                                                onClick={() => copyToClipboard(generateRnxCommand(selectedJob))}
                                                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center space-x-1"
                                                title="Copy to clipboard"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                                     viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                                </svg>
                                                <span>Copy</span>
                                            </button>
                                        </div>
                                        <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                                            <pre className="font-mono text-sm whitespace-pre-wrap break-words">
                                                {generateRnxCommand(selectedJob)}
                                            </pre>
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            This command can be used to recreate this job via the RNX CLI
                                        </p>
                                    </div>

                                    {/* Resource Limits */}
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Resource Limits</h4>
                                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Max CPU</dt>
                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.maxCPU}%</dd>
                                            </div>
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Max Memory</dt>
                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.maxMemory} MB</dd>
                                            </div>
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Max IO BPS</dt>
                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.maxIOBPS} bytes/s</dd>
                                            </div>
                                            {selectedJob.cpuCores && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU Cores</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.cpuCores}</dd>
                                                </div>
                                            )}
                                            {selectedJob.gpuCount !== undefined && selectedJob.gpuCount > 0 && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">GPU Count</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.gpuCount}</dd>
                                                </div>
                                            )}
                                            {selectedJob.gpuMemoryMb !== undefined && selectedJob.gpuMemoryMb > 0 && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">GPU Memory</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.gpuMemoryMb} MB</dd>
                                                </div>
                                            )}
                                        </dl>
                                    </div>

                                    {/* Volumes */}
                                    {selectedJob.volumes && selectedJob.volumes.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Volumes</h4>
                                            <ul className="list-disc list-inside space-y-1">
                                                {selectedJob.volumes.map((volume, index) => (
                                                    <li key={index}
                                                        className="text-sm text-gray-900 dark:text-white font-mono">{volume}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Environment Variables */}
                                    {selectedJob.envVars && Object.keys(selectedJob.envVars).length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Environment
                                                Variables</h4>
                                            <dl className="space-y-2">
                                                {Object.entries(selectedJob.envVars).map(([key, value]) => (
                                                    <div key={key}>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">{key}</dt>
                                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono break-all">{value}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        </div>
                                    )}

                                    {/* Dependencies */}
                                    {selectedJob.dependsOn && selectedJob.dependsOn.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Dependencies</h4>
                                            <ul className="list-disc list-inside space-y-1">
                                                {selectedJob.dependsOn.map((dep, index) => (
                                                    <li key={index}
                                                        className="text-sm text-gray-900 dark:text-white font-mono">{dep}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 dark:text-gray-400">Failed to load job details</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Metrics Tab */}
                    {activeTab === 'metrics' && (
                        <JobMetrics jobId={jobId}/>
                    )}

                    {/* Telematics Tab - eBPF Events */}
                    {activeTab === 'telematics' && (
                        <JobActivity jobId={jobId}/>
                    )}
                </div>
            </div>
        </div>
    );
};
