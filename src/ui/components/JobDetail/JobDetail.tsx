import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {Job} from '../../types/job';
import {useLogStream} from '../../hooks/useLogStream';
import {apiService} from '../../services/apiService';
import {JobMetrics} from '../JobMetrics/JobMetrics';
import {useDateFormatter} from '../../hooks/useDateFormatter';

interface JobDetailProps {
    jobId: string;
    onClose: () => void;
    isWorkflowJob?: boolean;
    workflowJobs?: any[];
}

export const JobDetail: React.FC<JobDetailProps> = ({
    jobId,
    onClose,
    isWorkflowJob = false,
    workflowJobs = []
}) => {
    const {formatDateTime} = useDateFormatter();
    const [activeTab, setActiveTab] = useState<'logs' | 'details' | 'metrics'>('logs');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [jobLoading, setJobLoading] = useState<boolean>(false);
    const [autoScroll, setAutoScroll] = useState<boolean>(true);
    const [rnxJobId, setRnxJobId] = useState<string | null>(null);
    const logsContainerRef = useRef<HTMLDivElement>(null);

    const {logs, connected, error: logError, clearLogs} = useLogStream(rnxJobId);

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

            // For workflow jobs, check if they have started (have an RNX job ID)
            if (isWorkflowJob) {
                const workflowJob = workflowJobs.find(j => j.id === jobId);
                if (workflowJob?.rnxJobId) {
                    setRnxJobId(workflowJob.rnxJobId.toString());
                } else {
                    setRnxJobId(null);
                }
            } else {
                // For regular jobs, the job ID is the RNX job ID
                setRnxJobId(jobId);
            }
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

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-16 mx-auto p-5 border w-11/12 max-w-[90vw] min-h-[80vh] shadow-lg rounded-md bg-white dark:bg-gray-800">
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
                            Logs {isWorkflowJob && <span className="text-xs">(Workflow)</span>}
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
                    </nav>
                </div>

                <div className="py-4">
                    {/* Logs Tab */}
                    {activeTab === 'logs' && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {connected ? 'Connected' : 'Disconnected'}
                                            {isWorkflowJob && ' (Workflow Job)'}
                                        </span>
                                    </div>
                                    {/* Show auto-scroll for jobs that have logs available */}
                                    {(rnxJobId || !isWorkflowJob) && (
                                        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                            <input
                                                type="checkbox"
                                                checked={autoScroll}
                                                onChange={(e) => setAutoScroll(e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>Auto-scroll</span>
                                        </label>
                                    )}
                                </div>
                                <button
                                    onClick={clearLogs}
                                    className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded"
                                >
                                    Clear Logs
                                </button>
                            </div>

                            {logError && !isWorkflowJob && (
                                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
                                    Error: {logError}
                                </div>
                            )}

                            <div
                                ref={logsContainerRef}
                                className="bg-black text-green-400 p-4 rounded-lg h-[70vh] overflow-y-auto font-mono text-sm"
                            >
                                {/* Display appropriate message based on job state */}
                                {!rnxJobId && isWorkflowJob ? (
                                    <div className="text-gray-500">
                                        {(() => {
                                            const job = workflowJobs.find(j => j.id === jobId);
                                            const status = job?.status?.toUpperCase();
                                            if (status === 'CANCELLED' || status === 'CANCELED') return 'Job was cancelled. No logs available.';
                                            if (status === 'QUEUED' || status === 'PENDING') return 'Job is queued/pending. No logs yet.';
                                            return 'Job has not started executing. No logs available.';
                                        })()}
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="text-gray-500">
                                        {isWorkflowJob ? "Loading workflow job logs..." : "No logs available yet..."}
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
                                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading job details...</span>
                                </div>
                            ) : selectedJob ? (
                                <>
                                    {/* Basic Information */}
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
                                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Job ID</dt>
                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{selectedJob.id}</dd>
                                            </div>
                                            {selectedJob.name && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Job Name</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.name}</dd>
                                                </div>
                                            )}
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                                                <dd className="mt-1">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedJob.status)}`}>
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
                                            {selectedJob.startTime && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Start Time</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(selectedJob.startTime)}</dd>
                                                </div>
                                            )}
                                            {selectedJob.endTime && (
                                                <div>
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">End Time</dt>
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
                                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Exit Code</dt>
                                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{selectedJob.exitCode}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    </div>

                                    {/* Resource Limits */}
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Resource Limits</h4>
                                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        </dl>
                                    </div>

                                    {/* Volumes */}
                                    {selectedJob.volumes && selectedJob.volumes.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Volumes</h4>
                                            <ul className="list-disc list-inside space-y-1">
                                                {selectedJob.volumes.map((volume, index) => (
                                                    <li key={index} className="text-sm text-gray-900 dark:text-white font-mono">{volume}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Environment Variables */}
                                    {selectedJob.envVars && Object.keys(selectedJob.envVars).length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Environment Variables</h4>
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
                                                    <li key={index} className="text-sm text-gray-900 dark:text-white font-mono">{dep}</li>
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
                        <JobMetrics jobId={rnxJobId || jobId}/>
                    )}
                </div>
            </div>
        </div>
    );
};
