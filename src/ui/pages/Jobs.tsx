import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useJobs} from '../hooks/useJobs';
import {Job} from '../types/job';
import {ChevronLeft, ChevronRight, FileText, Play, Plus, Square, Trash2, X, XCircle} from 'lucide-react';
import {SimpleJobBuilder} from '../components/JobBuilder/SimpleJobBuilder';
import {JobDetail} from '../components/JobDetail/JobDetail';

const Jobs: React.FC = () => {
    const {t} = useTranslation();
    const {
        loading,
        error,
        currentPage,
        pageSize,
        totalJobs,
        totalPages,
        paginatedJobs,
        setCurrentPage,
        setPageSize,
        stopJob,
        cancelJob,
        deleteJob,
        refreshJobs,
        deleteAllJobs
    } = useJobs();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);
    const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [showCreateJob, setShowCreateJob] = useState<boolean>(false);
    const [stopJobConfirm, setStopJobConfirm] = useState<{
        show: boolean;
        jobId: string;
        stopping: boolean;
    }>({
        show: false,
        jobId: '',
        stopping: false
    });
    const [deleteAllConfirm, setDeleteAllConfirm] = useState<{
        show: boolean;
        deleting: boolean;
    }>({
        show: false,
        deleting: false
    });
    const [deleteJobConfirm, setDeleteJobConfirm] = useState<{
        show: boolean;
        jobId: string;
        deleting: boolean;
    }>({
        show: false,
        jobId: '',
        deleting: false
    });
    const [cancelJobConfirm, setCancelJobConfirm] = useState<{
        show: boolean;
        jobId: string;
        canceling: boolean;
    }>({
        show: false,
        jobId: '',
        canceling: false
    });

    const handleJobCreated = () => {
        setShowCreateJob(false);
        // Immediately refresh the jobs list to show the new job
        refreshJobs();
    };

    const handleCloseCreateJob = () => {
        setShowCreateJob(false);
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
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const shortenUuid = (uuid: string) => {
        if (!uuid) return '-';
        // If it looks like a UUID (contains hyphens or is long), show first 8 characters
        if (uuid.includes('-') || uuid.length > 12) {
            return uuid.substring(0, 8);
        }
        // Otherwise return as-is (might already be short)
        return uuid;
    };

    const formatDuration = (duration: number) => {
        if (!duration) return '-';
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const formatGpuInfo = (job: Job) => {
        if (!job.gpuCount || job.gpuCount === 0) return '-';

        const parts = [`${job.gpuCount}x GPU`];
        if (job.gpuMemoryMb && job.gpuMemoryMb > 0) {
            parts.push(`${job.gpuMemoryMb}MB`);
        }
        if (job.gpuIndices && job.gpuIndices.length > 0) {
            parts.push(`[${job.gpuIndices.join(',')}]`);
        }
        return parts.join(' ');
    };

    const handleViewJob = (jobId: string) => {
        if (!jobId) {
            console.warn('Cannot view job: job ID is undefined');
            return;
        }
        setSelectedJobId(jobId);
    };

    const handleStopJob = (jobId: string) => {
        setStopJobConfirm({show: true, jobId, stopping: false});
    };

    const confirmStopJob = async () => {
        if (!stopJobConfirm.jobId) return;

        setStopJobConfirm(prev => ({...prev, stopping: true}));
        setStoppingJobId(stopJobConfirm.jobId);
        try {
            await stopJob(stopJobConfirm.jobId);
            setStopJobConfirm({show: false, jobId: '', stopping: false});
        } catch (error) {
            console.error('Failed to stop job:', error);
            alert('Failed to stop job: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setStopJobConfirm(prev => ({...prev, stopping: false}));
        } finally {
            setStoppingJobId(null);
        }
    };

    const cancelStopJob = () => {
        setStopJobConfirm({show: false, jobId: '', stopping: false});
    };

    const handleDeleteAllJobs = () => {
        setDeleteAllConfirm({show: true, deleting: false});
    };

    const confirmDeleteAllJobs = async () => {
        setDeleteAllConfirm(prev => ({...prev, deleting: true}));
        try {
            await deleteAllJobs();
            setDeleteAllConfirm({show: false, deleting: false});
        } catch (error) {
            console.error('Failed to delete all jobs:', error);
            alert('Failed to delete all jobs: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setDeleteAllConfirm(prev => ({...prev, deleting: false}));
        }
    };

    const cancelDeleteAllJobs = () => {
        setDeleteAllConfirm({show: false, deleting: false});
    };

    const handleDeleteJob = (jobId: string) => {
        setDeleteJobConfirm({show: true, jobId, deleting: false});
    };

    const confirmDeleteJob = async () => {
        if (!deleteJobConfirm.jobId) return;

        setDeleteJobConfirm(prev => ({...prev, deleting: true}));
        setDeletingJobId(deleteJobConfirm.jobId);
        try {
            await deleteJob(deleteJobConfirm.jobId);
            setDeleteJobConfirm({show: false, jobId: '', deleting: false});
        } catch (error) {
            console.error('Failed to delete job:', error);
            alert('Failed to delete job: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setDeleteJobConfirm(prev => ({...prev, deleting: false}));
        } finally {
            setDeletingJobId(null);
        }
    };

    const cancelDeleteJob = () => {
        setDeleteJobConfirm({show: false, jobId: '', deleting: false});
    };

    const handleCancelJob = (jobId: string) => {
        setCancelJobConfirm({show: true, jobId, canceling: false});
    };

    const confirmCancelJob = async () => {
        if (!cancelJobConfirm.jobId) return;

        setCancelJobConfirm(prev => ({...prev, canceling: true}));
        setCancelingJobId(cancelJobConfirm.jobId);
        try {
            await cancelJob(cancelJobConfirm.jobId);
            setCancelJobConfirm({show: false, jobId: '', canceling: false});
        } catch (error) {
            console.error('Failed to cancel job:', error);
            alert('Failed to cancel job: ' + (error instanceof Error ? error.message : 'Unknown error'));
            setCancelJobConfirm(prev => ({...prev, canceling: false}));
        } finally {
            setCancelingJobId(null);
        }
    };

    const cancelCancelJob = () => {
        setCancelJobConfirm({show: false, jobId: '', canceling: false});
    };

    const handleCloseModal = () => {
        setSelectedJobId(null);
    };

    // Handle escape key to close modal
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

    // Handle escape key to close create job dialog
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && showCreateJob) {
                handleCloseCreateJob();
            }
        };

        document.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showCreateJob]);

    return (
        <div className="p-6">
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Jobs</h1>
                        <p className="mt-2 text-gray-300">Manage and monitor job execution</p>
                        <div className="mt-2 flex items-center text-sm">
                            <div className="w-2 h-2 rounded-full mr-2 bg-green-500 animate-pulse"></div>
                            <span className="text-gray-400">Auto-refresh enabled (5s)</span>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        {totalJobs > 0 && (
                            <button
                                onClick={handleDeleteAllJobs}
                                className="inline-flex items-center px-4 py-2 border border-red-600 rounded-md shadow-sm text-sm font-medium text-red-300 bg-transparent hover:bg-red-600 hover:text-white"
                                title="Delete all non-running jobs"
                            >
                                <Trash2 className="h-4 w-4 mr-2"/>
                                Delete All Jobs
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreateJob(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2"/>
                            {t('jobs.newJob')}
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <p className="text-white">{t('jobs.loadingJobs')}</p>
                    </div>
                </div>
            ) : error ? (
                <div className="bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <p className="text-red-500">{t('common.error')}: {error}</p>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-white">
                                {t('jobs.title')} ({totalJobs})
                            </h3>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-300">Show:</label>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                        className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span className="text-sm text-gray-300">per page</span>
                                </div>
                                <div className="text-sm text-gray-300">
                                    Showing {totalJobs === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalJobs)} of {totalJobs}
                                </div>
                            </div>
                        </div>
                    </div>

                    {totalJobs === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-gray-500">{t('jobs.noJobs')}</p>
                            <p className="text-sm text-gray-400 mt-1">Create your first job to get started</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-auto">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Job
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Command
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Duration
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            GPU
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Started
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-auto divide-y divide-gray-200">
                                    {paginatedJobs.map((job, index) => (
                                        <tr key={job.id || `job-${index}`} className="hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm text-white font-mono" title={job.id}>
                                                        {shortenUuid(job.id)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                        <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-white max-w-xs truncate">
                                                    {job.command} {job.args?.join(' ') || ''}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {(job.startTime && job.endTime) ?
                                                    formatDuration(new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {formatGpuInfo(job)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {job.startTime ? new Date(job.startTime).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => job.id && handleViewJob(job.id)}
                                                        className="text-green-600 hover:text-green-300"
                                                        title="View Job Details & Logs"
                                                    >
                                                        <FileText className="h-4 w-4"/>
                                                    </button>
                                                    {job.status === 'RUNNING' && (
                                                        <button
                                                            onClick={() => handleStopJob(job.id)}
                                                            disabled={stoppingJobId === job.id}
                                                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={stoppingJobId === job.id ? "Stopping..." : "Stop Job"}
                                                        >
                                                            <Square className="h-4 w-4"/>
                                                        </button>
                                                    )}
                                                    {job.status === 'SCHEDULED' && (
                                                        <button
                                                            onClick={() => handleCancelJob(job.id)}
                                                            disabled={cancelingJobId === job.id}
                                                            className="text-orange-600 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={cancelingJobId === job.id ? "Canceling..." : "Cancel Scheduled Job"}
                                                        >
                                                            <XCircle className="h-4 w-4"/>
                                                        </button>
                                                    )}
                                                    {(job.status === 'QUEUED' || job.status === 'PENDING') && (
                                                        <button className="text-blue-600 hover:text-blue-300">
                                                            <Play className="h-4 w-4"/>
                                                        </button>
                                                    )}
                                                    {(job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'STOPPED') && (
                                                        <button
                                                            onClick={() => handleDeleteJob(job.id)}
                                                            disabled={deletingJobId === job.id}
                                                            className="text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={deletingJobId === job.id ? "Deleting..." : "Delete Job"}
                                                        >
                                                            <Trash2 className="h-4 w-4"/>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-300">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <button
                                                onClick={() => setCurrentPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                            >
                                                <ChevronLeft className="h-4 w-4 mr-1"/>
                                                Previous
                                            </button>

                                            {/* Page Numbers */}
                                            <div className="flex items-center space-x-1">
                                                {Array.from({length: Math.min(totalPages, 5)}, (_, i) => {
                                                    let pageNum: number;
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i;
                                                    } else {
                                                        pageNum = currentPage - 2 + i;
                                                    }

                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`px-3 py-1 border rounded text-sm ${
                                                                currentPage === pageNum
                                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                                    : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4 ml-1"/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Command Preview Section */}
                            <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-200 mb-4">Command Examples</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Run Simple Job
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job run "echo Hello World"
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Run with Runtime
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job run "python3 script.py" --runtime=python-3.11
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            List Jobs
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job list
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Stop Job
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-red-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job stop &lt;job-id&gt;
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            View Job Logs
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-blue-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job logs &lt;job-id&gt;
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Run with Resources
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job run "npm test" --cpu=50 --memory=512MB
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Delete All Non-Running Jobs
                                        </label>
                                        <pre
                                            className="bg-gray-900 text-red-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job delete-all
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Job Details Modal */}
            {selectedJobId && (
                <JobDetail
                    jobId={selectedJobId}
                    onClose={handleCloseModal}
                    isWorkflowJob={false}
                    workflowJobs={[]}
                />
            )}

            {/* Stop Job Confirmation Dialog */}
            {stopJobConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Stop Job
                                </h3>
                                <button
                                    onClick={cancelStopJob}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={stopJobConfirm.stopping}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to stop job "{stopJobConfirm.jobId}"?
                                    </p>
                                    <p className="text-sm text-orange-400">
                                        This will terminate the running job immediately. Any unsaved work may be lost.
                                    </p>
                                </div>

                                {/* Command Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-orange-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx job stop ${stopJobConfirm.jobId}`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelStopJob}
                                    disabled={stopJobConfirm.stopping}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmStopJob}
                                    disabled={stopJobConfirm.stopping}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {stopJobConfirm.stopping ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Stopping...
                                        </>
                                    ) : (
                                        <>
                                            <Square className="h-4 w-4 mr-2"/>
                                            Stop Job
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Job Dialog */}
            {showCreateJob && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div
                        className="relative bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-600">
                            <h3 className="text-lg font-medium text-gray-200">{t('jobs.createNew')}</h3>
                            <button
                                onClick={handleCloseCreateJob}
                                className="text-gray-400 hover:text-gray-300"
                            >
                                <X className="h-5 w-5"/>
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                            <SimpleJobBuilder
                                onJobCreated={handleJobCreated}
                                onClose={handleCloseCreateJob}
                                showHeader={false}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Delete All Jobs Confirmation Dialog */}
            {deleteAllConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Delete All Jobs
                                </h3>
                                <button
                                    onClick={cancelDeleteAllJobs}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={deleteAllConfirm.deleting}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to delete all non-running jobs?
                                    </p>
                                    <p className="text-sm text-red-400">
                                        This will permanently delete all completed, failed, and stopped jobs including
                                        their logs and metadata. Running and scheduled jobs will not be affected.
                                    </p>
                                    <p className="text-sm text-orange-400 mt-2">
                                        This action cannot be UNDONE.
                                    </p>
                                </div>

                                {/* Command Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-red-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx job delete-all`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelDeleteAllJobs}
                                    disabled={deleteAllConfirm.deleting}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteAllJobs}
                                    disabled={deleteAllConfirm.deleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {deleteAllConfirm.deleting ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2"/>
                                            Delete All Jobs
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Job Confirmation Dialog */}
            {deleteJobConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Delete Job
                                </h3>
                                <button
                                    onClick={cancelDeleteJob}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={deleteJobConfirm.deleting}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to delete job "{deleteJobConfirm.jobId}"?
                                    </p>
                                    <p className="text-sm text-red-400">
                                        This will permanently delete the job including its logs and metadata.
                                    </p>
                                    <p className="text-sm text-orange-400 mt-2">
                                        This action cannot be UNDONE.
                                    </p>
                                </div>

                                {/* Command Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-red-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx job delete ${deleteJobConfirm.jobId}`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelDeleteJob}
                                    disabled={deleteJobConfirm.deleting}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteJob}
                                    disabled={deleteJobConfirm.deleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {deleteJobConfirm.deleting ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2"/>
                                            Delete Job
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Job Confirmation Dialog */}
            {cancelJobConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Cancel Scheduled Job
                                </h3>
                                <button
                                    onClick={cancelCancelJob}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={cancelJobConfirm.canceling}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to cancel scheduled job "{cancelJobConfirm.jobId}"?
                                    </p>
                                    <p className="text-sm text-orange-400">
                                        This will prevent the scheduled job from running at its designated time. The job
                                        will be removed from the schedule.
                                    </p>
                                </div>

                                {/* Command Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-orange-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx job cancel ${cancelJobConfirm.jobId}`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelCancelJob}
                                    disabled={cancelJobConfirm.canceling}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmCancelJob}
                                    disabled={cancelJobConfirm.canceling}
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {cancelJobConfirm.canceling ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Canceling...
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="h-4 w-4 mr-2"/>
                                            Cancel Job
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Jobs;