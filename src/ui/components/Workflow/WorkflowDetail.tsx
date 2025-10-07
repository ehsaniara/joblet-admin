import {useCallback, useEffect, useState} from 'react';
import {Job, WorkflowJob} from '@/types';
import WorkflowMermaidGraph from './WorkflowMermaidGraph';
import WorkflowTimeline from './WorkflowTimeline';
import {BarChart3, Code, FileText, List, Network} from 'lucide-react';
import {apiService} from '@/services/apiService';
import {JobDetail} from '../JobDetail';
import clsx from 'clsx';

interface WorkflowDetailProps {
    workflowId: string;
    onRefresh: () => void; // Keep for compatibility but not used since WebSocket handles updates
}

interface WorkflowData {
    uuid: string;
    name: string;
    workflow: string;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'QUEUED' | 'STOPPED';
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    jobs: WorkflowJob[];
    yamlContent?: string;
}

type ViewMode = 'graph' | 'tree' | 'timeline' | 'yaml';

const WorkflowDetail: React.FC<WorkflowDetailProps> = ({
                                                           workflowId,
                                                       }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('graph');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Job Details Modal State
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const fetchWorkflow = useCallback(async (retryCount = 0) => {
        try {
            setLoading(true);
            setError(null);
            const workflowData = await apiService.getWorkflow(workflowId);

            // Calculate actual workflow status based on job statuses
            // The backend status might be incorrect, so we determine it from jobs
            if (workflowData.jobs && workflowData.jobs.length > 0) {
                const jobStatuses = workflowData.jobs.map((j: any) => j.status?.toUpperCase());
                const hasFailedJobs = jobStatuses.some((s: string) => s === 'FAILED');
                const hasCanceledJobs = jobStatuses.some((s: string) => s === 'CANCELED' || s === 'CANCELLED');
                const hasRunningJobs = jobStatuses.some((s: string) => s === 'RUNNING');
                const allJobsFinished = jobStatuses.every((s: string) =>
                    s === 'COMPLETED' || s === 'FAILED' || s === 'CANCELED' || s === 'CANCELLED'
                );

                // Determine correct workflow status
                if (hasFailedJobs) {
                    workflowData.status = 'FAILED';
                } else if (hasRunningJobs) {
                    workflowData.status = 'RUNNING';
                } else if (hasCanceledJobs && allJobsFinished) {
                    workflowData.status = 'CANCELED';
                } else if (allJobsFinished) {
                    workflowData.status = 'COMPLETED';
                }
            }

            setWorkflow(workflowData);
            setLoading(false);
        } catch (err) {
            // If workflow not found and this is the first attempt, retry after a delay
            // This handles the case where workflow was just created and not yet registered
            if (err instanceof Error && err.message.includes('404') && retryCount < 3) {
                console.log(`Workflow not found, retrying... (attempt ${retryCount + 1}/3)`);
                setTimeout(() => {
                    void fetchWorkflow(retryCount + 1);
                }, 1000); // Wait 1 second before retrying
                return;
            }
            setError(err instanceof Error ? err.message : 'Failed to fetch workflow');
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => {
        void fetchWorkflow();
    }, [fetchWorkflow]);

    const handleJobSelect = (job: WorkflowJob | null) => {
        setSelectedJob(job);
        // Open job details dialog when job is selected from graph
        if (job) {
            void handleViewJob(job.id);
        }
    };

    const handleJobAction = (jobId: string, action: string) => {
        if (action === 'details') {
            void handleViewJob(jobId);
        }
    };

    const handleViewJob = (jobId: string) => {
        setSelectedJobId(jobId);
    };


    const handleCloseModal = () => {
        setSelectedJobId(null);
    };

    // Handle escape key to close job details modal
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && selectedJobId) {
                handleCloseModal();
            }
        };

        document.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [selectedJobId]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING':
                return 'bg-yellow-900 text-yellow-200';
            case 'COMPLETED':
                return 'bg-green-900 text-green-200';
            case 'FAILED':
                return 'bg-red-900 text-red-200';
            case 'STOPPED':
                return 'bg-gray-700 text-gray-200';
            case 'QUEUED':
                return 'bg-blue-900 text-blue-200';
            default:
                return 'bg-gray-700 text-gray-200';
        }
    };

    const viewModes = [
        {key: 'graph' as ViewMode, label: 'Graph View', icon: Network},
        {key: 'tree' as ViewMode, label: 'Tree View', icon: List},
        {key: 'timeline' as ViewMode, label: 'Timeline', icon: BarChart3},
        {key: 'yaml' as ViewMode, label: 'YAML Source', icon: Code},
    ];

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        <div className="text-lg text-white">Loading workflow...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !workflow) {
        return (
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-4">
                        <div className="text-lg text-red-500">Error: {error || 'Workflow not found'}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-4 mb-4">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3">
                            <h1 className="text-3xl font-bold text-white">{workflow.name}</h1>
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}
                            >
                                {workflow.status}
                            </span>
                        </div>
                        <p className="mt-2 text-gray-300">Workflow: {workflow.uuid}</p>
                    </div>
                    <div className="flex items-center text-sm">
                        <div className="w-2 h-2 rounded-full mr-2 bg-green-500 animate-pulse"></div>
                        <span className="text-gray-400">Live Updates</span>
                    </div>
                </div>

                {/* View Mode Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {viewModes.map(({key, label, icon: Icon}) => (
                            <button
                                key={key}
                                onClick={() => setViewMode(key)}
                                className={clsx(
                                    'py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center',
                                    viewMode === key
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                )}
                            >
                                <Icon className="w-4 h-4 mr-2"/>
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {/* Graph View */}
                {viewMode === 'graph' && (
                    <WorkflowMermaidGraph
                        jobs={workflow.jobs}
                        onJobSelect={handleJobSelect}
                        onJobAction={handleJobAction}
                    />
                )}

                {/* Tree View */}
                {viewMode === 'tree' && (
                    <div className="p-6">
                        <div className="bg-gray-800 rounded-lg shadow">
                            <div className="p-6">
                                <h3 className="text-lg font-medium text-white mb-4">
                                    Workflow Execution Tree
                                </h3>
                                {workflow.jobs.length === 0 ? (
                                    <div className="text-center py-8">
                                        <List className="w-8 h-8 text-gray-400 mx-auto mb-2"/>
                                        <p className="text-gray-500">No jobs executed in this workflow yet</p>
                                        <p className="text-sm text-gray-400 mt-2">Execute the workflow to see job
                                            details</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(() => {
                                            // Topological sort based on dependencies
                                            const jobs = [...workflow.jobs];
                                            const sorted: typeof jobs = [];
                                            const visited = new Set<string>();
                                            const temp = new Set<string>();

                                            // Helper function to find job by name or id
                                            const findJob = (nameOrId: string) =>
                                                jobs.find(j => j.name === nameOrId || j.id === nameOrId);

                                            // Depth-first search for topological sorting
                                            const visit = (job: typeof jobs[0]) => {
                                                if (temp.has(job.id)) return; // Circular dependency, skip
                                                if (visited.has(job.id)) return;

                                                temp.add(job.id);

                                                // Visit dependencies first
                                                if (job.dependsOn) {
                                                    for (const dep of job.dependsOn) {
                                                        const depJob = findJob(dep);
                                                        if (depJob) {
                                                            visit(depJob);
                                                        }
                                                    }
                                                }

                                                temp.delete(job.id);
                                                visited.add(job.id);
                                                sorted.push(job);
                                            };

                                            // Visit all jobs
                                            for (const job of jobs) {
                                                if (!visited.has(job.id)) {
                                                    visit(job);
                                                }
                                            }

                                            return sorted;
                                        })().map(job => (
                                            <div key={job.id}
                                                 className="border border-gray-600 rounded-lg p-4 hover:bg-gray-700 cursor-pointer"
                                                 onClick={() => {
                                                     void handleViewJob(job.id);
                                                 }}
                                                 style={{marginLeft: `${(job.dependsOn?.length || 0) * 20}px`}}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-3">
                                                            {job.dependsOn && job.dependsOn.length > 0 && (
                                                                <span className="text-gray-500 text-xs">└─</span>
                                                            )}
                                                            <div>
                                                                <h4 className="font-medium text-white">{job.name || job.id}</h4>
                                                                <p className="text-xs text-gray-400">UUID: {job.id}</p>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleViewJob(job.id);
                                                                }}
                                                                className="text-green-600 hover:text-green-300"
                                                                title="View Job Details & Logs"
                                                            >
                                                                <FileText className="h-4 w-4"/>
                                                            </button>
                                                        </div>
                                                        <p className="text-sm text-gray-300">
                                                            {job.command} {job.args?.join(' ') || ''}
                                                        </p>
                                                        {job.dependsOn && job.dependsOn.length > 0 && (
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                Depends on: {job.dependsOn.join(', ')}
                                                            </p>
                                                        )}
                                                        {(job as any).start_time && (
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                Started: {new Date((job as any).start_time).toLocaleString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className={clsx(
                                                        'px-2 py-1 rounded-full text-xs font-medium',
                                                        getStatusColor(job.status)
                                                    )}>
                                                        {job.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Timeline View */}
                {viewMode === 'timeline' && (
                    <WorkflowTimeline
                        jobs={workflow.jobs}
                        onJobClick={handleViewJob}
                    />
                )}

                {/* YAML View */}
                {viewMode === 'yaml' && (
                    <div className="p-6">
                        {!workflow.yamlContent ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                                <div className="flex items-center">
                                    <FileText className="h-5 w-5 text-yellow-400 mr-2"/>
                                    <h3 className="text-yellow-800 font-medium">YAML content not available</h3>
                                </div>
                                <p className="text-yellow-700 mt-2">The YAML source for this workflow is not available.</p>
                            </div>
                        ) : (
                            <div>
                                <div className="mb-4 text-sm text-gray-400">
                                    <div><strong>Source:</strong> Original workflow YAML</div>
                                    <div><strong>Workflow ID:</strong> {workflow.uuid}</div>
                                </div>
                                <div className="bg-gray-900 rounded-md p-4 overflow-auto max-h-[70vh] border border-gray-700">
                                    <pre className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
                                        <code>{workflow.yamlContent}</code>
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="border-t border-gray-800 px-6 py-3 bg-blue-950">
                <div className="flex items-center justify-between text-sm text-gray-300">
                    <div>
                        <span>{workflow.jobs.length} jobs in workflow</span>
                        {workflow.completed_at && (
                            <span className="ml-4">
                                Completed: {new Date(workflow.completed_at).toLocaleString()}
                            </span>
                        )}
                    </div>
                    {selectedJob && (
                        <div>
                            Selected: {selectedJob.id} ({selectedJob.status})
                        </div>
                    )}
                </div>
            </div>

            {/* Job Details Modal */}
            {selectedJobId && (
                <JobDetail
                    jobId={selectedJobId}
                    onClose={handleCloseModal}
                    isWorkflowJob={true}
                    workflowJobs={workflow?.jobs || []}
                />
            )}
        </div>
    );
};

export default WorkflowDetail;