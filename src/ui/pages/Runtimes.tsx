import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Cpu, FileCode, RefreshCw, Trash2, Upload, X, Zap} from 'lucide-react';
import {apiService} from '../services/apiService';
import {useNode} from '../contexts/NodeContext';

interface Runtime {
    id: string;
    name: string;
    version: string;
    size: string;
    sizeBytes?: number;
    description: string;
}

const Runtimes: React.FC = () => {
    const {t} = useTranslation();
    const {selectedNode} = useNode();
    const [runtimes, setRuntimes] = useState<Runtime[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(18);

    const [deleteRuntimeConfirm, setDeleteRuntimeConfirm] = useState<{
        show: boolean;
        runtimeName: string;
        deleting: boolean;
    }>({
        show: false,
        runtimeName: '',
        deleting: false
    });

    const [installProgress, setInstallProgress] = useState({
        show: false,
        runtimeName: '',
        buildJobId: '',
        logs: [] as string[],
        status: 'building' as 'building' | 'completed' | 'failed' | 'error'
    });

    // Build runtime from YAML dialog state
    const [buildRuntimeDialog, setBuildRuntimeDialog] = useState({
        show: false,
        yamlContent: '',
        dryRun: false,
        verbose: true,
        forceRebuild: false,
        validating: false,
        validation: null as null | {
            valid: boolean;
            message: string;
            errors: string[];
            warnings: string[];
            specInfo: {
                name: string;
                version: string;
                language: string;
                languageVersion: string;
                description: string;
                pipPackages: string[];
                npmPackages: string[];
                hasHooks: boolean;
                requiresGpu: boolean;
            } | null;
        }
    });

    const logsEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Runtime details dialog state
    const [runtimeDetailsDialog, setRuntimeDetailsDialog] = useState<{
        show: boolean;
        loading: boolean;
        error: string;
        activeTab: 'details' | 'packages' | 'yaml';
        details: {
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
            timeout?: string | number | null;
            hooks?: {
                preInstall?: string;
                postInstall?: string;
            } | null;
            originalYaml: string;
        } | null;
    }>({
        show: false,
        loading: false,
        error: '',
        activeTab: 'details',
        details: null
    });

    const fetchRuntimes = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await apiService.getRuntimes();
            setRuntimes(response.runtimes || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch runtimes');
        } finally {
            setLoading(false);
        }
    };

    const connectToBuildStream = (sessionId: string) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/runtime-build/${sessionId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to runtime build stream');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            setInstallProgress(prev => {
                const newLogs = [...prev.logs];

                if (message.type === 'log') {
                    const levelPrefix = message.level === 'error' ? '❌' : message.level === 'warn' ? '⚠️' : '';
                    newLogs.push(`${levelPrefix} ${message.message}`.trim());
                } else if (message.type === 'progress') {
                    const progressMsg = message.step && message.totalSteps
                        ? `[${message.step}/${message.totalSteps}] ${message.phaseName || ''}: ${message.message}`
                        : message.message;
                    newLogs.push(progressMsg);
                } else if (message.type === 'error') {
                    newLogs.push(`❌ ERROR: ${message.message}`);
                    return {
                        ...prev,
                        logs: newLogs,
                        status: 'failed'
                    };
                } else if (message.type === 'complete') {
                    const completeMsg = message.runtimeName
                        ? `✅ ${message.message} (${message.runtimeName} v${message.runtimeVersion || ''})`
                        : `✅ ${message.message}`;
                    newLogs.push(completeMsg);
                    if (message.sizeBytes) {
                        newLogs.push(`   Size: ${formatSize(message.sizeBytes)}`);
                    }
                    if (message.buildDurationMs) {
                        newLogs.push(`   Build time: ${(message.buildDurationMs / 1000).toFixed(1)}s`);
                    }
                    return {
                        ...prev,
                        logs: newLogs,
                        status: 'completed'
                    };
                } else if (message.type === 'connected') {
                    newLogs.push(message.message);
                } else if (message.type === 'end') {
                    return {
                        ...prev,
                        logs: newLogs,
                        status: prev.status === 'building' ? 'completed' : prev.status
                    };
                }

                return {
                    ...prev,
                    logs: newLogs
                };
            });

            // Auto-scroll to bottom
            setTimeout(() => {
                logsEndRef.current?.scrollIntoView({behavior: 'smooth'});
            }, 100);
        };

        ws.onclose = () => {
            console.log('Runtime build stream closed');
            setInstallProgress(prev => ({
                ...prev,
                status: prev.status === 'building' ? 'completed' : prev.status
            }));
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setInstallProgress(prev => ({
                ...prev,
                logs: [...prev.logs, '❌ Connection error occurred'],
                status: 'error'
            }));
        };
    };

    // Validate runtime YAML
    const validateRuntimeYAML = async () => {
        if (!buildRuntimeDialog.yamlContent.trim()) return;

        setBuildRuntimeDialog(prev => ({...prev, validating: true, validation: null}));

        try {
            const response = await fetch('/api/runtimes/validate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({yamlContent: buildRuntimeDialog.yamlContent})
            });

            if (!response.ok) {
                throw new Error(`Validation failed: ${response.status}`);
            }

            const result = await response.json();
            setBuildRuntimeDialog(prev => ({
                ...prev,
                validating: false,
                validation: result
            }));
        } catch (error) {
            setBuildRuntimeDialog(prev => ({
                ...prev,
                validating: false,
                validation: {
                    valid: false,
                    message: error instanceof Error ? error.message : 'Validation failed',
                    errors: [error instanceof Error ? error.message : 'Unknown error'],
                    warnings: [],
                    specInfo: null
                }
            }));
        }
    };

    // Build runtime from YAML
    const buildRuntimeFromYAML = async () => {
        if (!buildRuntimeDialog.yamlContent.trim()) return;

        try {
            const response = await fetch('/api/runtimes/build', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    node: selectedNode,
                    yamlContent: buildRuntimeDialog.yamlContent,
                    dryRun: buildRuntimeDialog.dryRun,
                    verbose: buildRuntimeDialog.verbose,
                    forceRebuild: buildRuntimeDialog.forceRebuild
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to start build: ${response.status}`);
            }

            const result = await response.json();

            if (result.sessionId) {
                // Close build dialog and open progress dialog
                setBuildRuntimeDialog(prev => ({...prev, show: false}));
                setInstallProgress({
                    show: true,
                    runtimeName: buildRuntimeDialog.validation?.specInfo?.name || 'Custom Runtime',
                    buildJobId: result.sessionId,
                    logs: ['Starting runtime build from YAML...'],
                    status: 'building'
                });

                // Connect to WebSocket for real-time logs
                connectToBuildStream(result.sessionId);
            }
        } catch (error) {
            setBuildRuntimeDialog(prev => ({
                ...prev,
                validation: {
                    valid: false,
                    message: error instanceof Error ? error.message : 'Build failed to start',
                    errors: [error instanceof Error ? error.message : 'Unknown error'],
                    warnings: [],
                    specInfo: prev.validation?.specInfo || null
                }
            }));
        }
    };

    // Open build runtime dialog
    const openBuildRuntimeDialog = () => {
        setBuildRuntimeDialog({
            show: true,
            yamlContent: `schema_version: "1.0"
name: my-runtime
version: 1.0.0
description: Custom Python runtime

base:
  language: python
  version: "3.11"

# Python packages (optional)
pip:
  - numpy
  - pandas

# Environment variables (optional)
environment:
  PYTHONUNBUFFERED: "1"

# Install hooks (optional)
# hooks:
#   pre_install: |
#     apt-get update && apt-get install -y libopenblas-dev
#   post_install: |
#     echo "Installation complete"

# GPU support (optional)
# gpu:
#   required: true
`,
            dryRun: false,
            verbose: true,
            forceRebuild: false,
            validating: false,
            validation: null
        });
    };

    // Close build runtime dialog
    const closeBuildRuntimeDialog = () => {
        setBuildRuntimeDialog({
            show: false,
            yamlContent: '',
            dryRun: false,
            verbose: true,
            forceRebuild: false,
            validating: false,
            validation: null
        });
    };

    // Handle file upload for runtime.yaml
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setBuildRuntimeDialog(prev => ({
                ...prev,
                yamlContent: content,
                validation: null
            }));
        };
        reader.onerror = () => {
            console.error('Failed to read file');
        };
        reader.readAsText(file);

        // Reset the input so the same file can be selected again
        event.target.value = '';
    };

    const closeInstallProgress = async () => {
        setInstallProgress({
            show: false,
            runtimeName: '',
            buildJobId: '',
            logs: [],
            status: 'building'
        });

        // Refresh runtimes list
        await fetchRuntimes();
    };

    const handleDeleteRuntime = (runtimeName: string) => {
        setDeleteRuntimeConfirm({show: true, runtimeName, deleting: false});
    };

    const confirmDeleteRuntime = async () => {
        if (!deleteRuntimeConfirm.runtimeName) return;

        setDeleteRuntimeConfirm(prev => ({...prev, deleting: true}));

        try {
            await apiService.deleteRuntime(deleteRuntimeConfirm.runtimeName);
            setDeleteRuntimeConfirm({show: false, runtimeName: '', deleting: false});
            await fetchRuntimes();
        } catch (err) {
            console.error('Failed to delete runtime:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete runtime');
            setDeleteRuntimeConfirm(prev => ({...prev, deleting: false}));
        }
    };

    const cancelDeleteRuntime = () => {
        setDeleteRuntimeConfirm({show: false, runtimeName: '', deleting: false});
    };

    // Show runtime details
    const showRuntimeDetails = async (runtimeName: string) => {
        setRuntimeDetailsDialog({
            show: true,
            loading: true,
            error: '',
            activeTab: 'details',
            details: null
        });

        try {
            const details = await apiService.getRuntimeDetails(runtimeName);
            setRuntimeDetailsDialog({
                show: true,
                loading: false,
                error: '',
                activeTab: 'details',
                details
            });
        } catch (err) {
            setRuntimeDetailsDialog({
                show: true,
                loading: false,
                error: err instanceof Error ? err.message : 'Failed to load runtime details',
                activeTab: 'details',
                details: null
            });
        }
    };

    const closeRuntimeDetails = () => {
        setRuntimeDetailsDialog({
            show: false,
            loading: false,
            error: '',
            activeTab: 'details',
            details: null
        });
    };

    // Close dialog on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (runtimeDetailsDialog.show) {
                    closeRuntimeDetails();
                } else if (buildRuntimeDialog.show) {
                    closeBuildRuntimeDialog();
                } else if (installProgress.show && installProgress.status !== 'building') {
                    closeInstallProgress();
                } else if (deleteRuntimeConfirm.show && !deleteRuntimeConfirm.deleting) {
                    cancelDeleteRuntime();
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [runtimeDetailsDialog.show, buildRuntimeDialog.show, installProgress.show, installProgress.status, deleteRuntimeConfirm.show, deleteRuntimeConfirm.deleting]);

    // Sync apiService with selected node and refresh when node changes
    useEffect(() => {
        apiService.setNode(selectedNode);
        fetchRuntimes();
    }, [selectedNode]);

    const formatSize = (size: string | number): string => {
        // If it's already a formatted string with units, return as-is
        if (typeof size === 'string' && /\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$/i.test(size)) {
            return size;
        }

        // Convert string to number if it's just a number
        const numericSize = typeof size === 'string' ? parseInt(size) : size;

        if (numericSize === 0 || isNaN(numericSize)) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(numericSize) / Math.log(k));
        return parseFloat((numericSize / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Pagination logic
    const totalPages = useMemo(() => Math.ceil(runtimes.length / itemsPerPage), [runtimes.length, itemsPerPage]);

    const paginatedRuntimes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return runtimes.slice(startIndex, startIndex + itemsPerPage);
    }, [runtimes, currentPage, itemsPerPage]);

    // Reset to page 1 when runtimes change
    useEffect(() => {
        setCurrentPage(1);
    }, [runtimes.length]);

    // Reset to page 1 if current page exceeds total pages
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Runtimes</h1>
                        <div className="mt-1 flex items-center text-sm">
                            <div className="w-2 h-2 rounded-full mr-2 bg-purple-500"></div>
                            <span className="text-gray-400">Runtime environments for jobs</span>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={fetchRuntimes}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-transparent hover:bg-gray-700"
                        >
                            <RefreshCw className="h-4 w-4 mr-2"/>
                            Refresh
                        </button>
                        <button
                            onClick={openBuildRuntimeDialog}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                        >
                            <FileCode className="h-4 w-4 mr-2"/>
                            Build Runtime
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="mb-4 grid grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 flex items-center">
                    <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                        <Zap className="h-5 w-5 text-purple-400"/>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Total Runtimes</p>
                        <p className="text-lg font-semibold text-white">{runtimes.length}</p>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 flex items-center">
                    <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                        <Cpu className="h-5 w-5 text-blue-400"/>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Python</p>
                        <p className="text-lg font-semibold text-white">
                            {runtimes.filter(r => r.name.toLowerCase().includes('python')).length}
                        </p>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 flex items-center">
                    <div className="p-2 bg-red-500/20 rounded-lg mr-3">
                        <Cpu className="h-5 w-5 text-red-400"/>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Java</p>
                        <p className="text-lg font-semibold text-white">
                            {runtimes.filter(r => r.name.toLowerCase().includes('java')).length}
                        </p>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 flex items-center">
                    <div className="p-2 bg-green-500/20 rounded-lg mr-3">
                        <Cpu className="h-5 w-5 text-green-400"/>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Node</p>
                        <p className="text-lg font-semibold text-white">
                            {runtimes.filter(r => r.name.toLowerCase().includes('node')).length}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <p className="text-white">{t('runtimes.loading', 'Loading runtimes...')}</p>
                    </div>
                </div>
            ) : error ? (
                <div className="bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <p className="text-red-500">{t('common.error', 'Error')}: {error}</p>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-white">
                                Runtimes ({runtimes.length})
                            </h3>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <label className="text-sm text-gray-300">Show:</label>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span className="text-sm text-gray-300">per page</span>
                                </div>
                                <div className="text-sm text-gray-300">
                                    Showing {runtimes.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, runtimes.length)} of {runtimes.length}
                                </div>
                            </div>
                        </div>
                    </div>

                    {runtimes.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-gray-500">No runtimes installed</p>
                            <p className="text-sm text-gray-400 mt-1">Build your first runtime to get started</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-auto">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Runtime
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Version
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Size
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-auto divide-y divide-gray-200">
                                    {paginatedRuntimes.map((runtime, index) => (
                                        <tr
                                            key={`${runtime.id || runtime.name}-${index}`}
                                            className="hover:bg-gray-700 cursor-pointer"
                                            onClick={() => showRuntimeDetails(runtime.name)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <Cpu className="h-5 w-5 text-purple-500 mr-3"/>
                                                    <span className="text-sm font-medium text-white">{runtime.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    v{runtime.version}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-400 max-w-md truncate">
                                                    {runtime.description || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                                                {formatSize(runtime.sizeBytes || runtime.size)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            showRuntimeDetails(runtime.name);
                                                        }}
                                                        className="text-purple-400 hover:text-purple-300"
                                                        title="View details"
                                                    >
                                                        <FileCode className="h-4 w-4"/>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteRuntime(runtime.name);
                                                        }}
                                                        className="text-red-400 hover:text-red-300"
                                                        title={t('runtimes.remove', 'Remove runtime')}
                                                    >
                                                        <Trash2 className="h-4 w-4"/>
                                                    </button>
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
                                                                    ? 'bg-purple-600 text-white border-purple-600'
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

                            {/* Command Examples Section */}
                            <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-200 mb-4">Command Examples</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            List Runtimes
                                        </label>
                                        <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx runtime list
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Build Runtime from YAML
                                        </label>
                                        <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx runtime build -f runtime.yaml
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Show Runtime Details
                                        </label>
                                        <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx runtime inspect python-3.11
                                        </pre>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Remove Runtime
                                        </label>
                                        <pre className="bg-gray-900 text-red-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx runtime remove python-3.11
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Delete Runtime Confirmation Dialog */}
            {deleteRuntimeConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Remove Runtime
                                </h3>
                                <button
                                    onClick={cancelDeleteRuntime}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={deleteRuntimeConfirm.deleting}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to remove the runtime "{deleteRuntimeConfirm.runtimeName}"?
                                    </p>
                                    <p className="text-sm text-red-400">
                                        This action cannot be undone. The runtime and all its files will be permanently deleted.
                                    </p>
                                </div>

                                {/* Command Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-red-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx runtime remove ${deleteRuntimeConfirm.runtimeName}`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelDeleteRuntime}
                                    disabled={deleteRuntimeConfirm.deleting}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteRuntime}
                                    disabled={deleteRuntimeConfirm.deleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {deleteRuntimeConfirm.deleting ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Removing...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2"/>
                                            Remove
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Runtime Installation Progress Dialog */}
            {installProgress.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div
                        className="relative bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-200">
                                        Installing Runtime: {installProgress.runtimeName}
                                    </h3>
                                    <p className="text-sm text-gray-400">Build Job: {installProgress.buildJobId}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {installProgress.status === 'building' && (
                                        <div
                                            className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                    )}
                                    {installProgress.status === 'completed' && (
                                        <span className="text-green-400 text-sm">✅ Complete</span>
                                    )}
                                    {installProgress.status === 'failed' && (
                                        <span className="text-red-400 text-sm">❌ Failed</span>
                                    )}
                                    <button
                                        onClick={closeInstallProgress}
                                        className="text-gray-400 hover:text-gray-300"
                                        disabled={installProgress.status === 'building'}
                                    >
                                        <X className="h-5 w-5"/>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <div className="font-mono text-sm space-y-1">
                                    {installProgress.logs.map((log, index) => (
                                        <div key={index} className={`
                                            ${log.startsWith('ERROR:') ? 'text-red-400' :
                                            log.startsWith('✅') ? 'text-green-400' :
                                                log.startsWith('❌') ? 'text-red-400' :
                                                    log.includes('[INFO]') ? 'text-blue-400' :
                                                        'text-gray-300'}
                                        `}>
                                            {log}
                                        </div>
                                    ))}
                                    <div ref={logsEndRef}/>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-600">
                                <p className="text-xs text-gray-400">
                                    Real-time streaming from RNX build process
                                </p>
                                <button
                                    onClick={closeInstallProgress}
                                    disabled={installProgress.status === 'building'}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed"
                                >
                                    {installProgress.status === 'building' ? 'Building...' : 'Close'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Build Runtime from YAML Dialog */}
            {buildRuntimeDialog.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div
                        className="relative bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="p-6 pb-4 flex-shrink-0 border-b border-gray-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <FileCode className="h-6 w-6 text-purple-500 mr-3"/>
                                    <h3 className="text-lg font-medium text-gray-200">
                                        Build Runtime from YAML
                                    </h3>
                                </div>
                                <button
                                    onClick={closeBuildRuntimeDialog}
                                    className="text-gray-400 hover:text-gray-300"
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-gray-400">
                                Define a custom runtime using a YAML specification. The runtime will be built on the server using OverlayFS isolation.
                            </p>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-6">
                                {/* YAML Editor */}
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium text-gray-300">
                                                Runtime YAML Specification
                                            </label>
                                            <div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".yaml,.yml"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="inline-flex items-center px-3 py-1.5 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                                                >
                                                    <Upload className="h-4 w-4 mr-2"/>
                                                    Upload YAML
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={buildRuntimeDialog.yamlContent}
                                            onChange={(e) => setBuildRuntimeDialog(prev => ({
                                                ...prev,
                                                yamlContent: e.target.value,
                                                validation: null
                                            }))}
                                            className="w-full h-80 px-3 py-2 border border-gray-600 rounded-md bg-gray-900 text-gray-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="Enter runtime YAML..."
                                            spellCheck={false}
                                        />
                                    </div>

                                    {/* Build Options */}
                                    <div className="space-y-3">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={buildRuntimeDialog.verbose}
                                                onChange={(e) => setBuildRuntimeDialog(prev => ({
                                                    ...prev,
                                                    verbose: e.target.checked
                                                }))}
                                                className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-300">Verbose output</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={buildRuntimeDialog.forceRebuild}
                                                onChange={(e) => setBuildRuntimeDialog(prev => ({
                                                    ...prev,
                                                    forceRebuild: e.target.checked
                                                }))}
                                                className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-300">Force rebuild (replace if exists)</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={buildRuntimeDialog.dryRun}
                                                onChange={(e) => setBuildRuntimeDialog(prev => ({
                                                    ...prev,
                                                    dryRun: e.target.checked
                                                }))}
                                                className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-gray-300">Dry run (validate only)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Validation Results */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Validation & Preview
                                        </label>
                                        <button
                                            onClick={validateRuntimeYAML}
                                            disabled={buildRuntimeDialog.validating || !buildRuntimeDialog.yamlContent.trim()}
                                            className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed"
                                        >
                                            {buildRuntimeDialog.validating ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                    Validating...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="h-4 w-4 mr-2"/>
                                                    Validate YAML
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Validation Results Display */}
                                    {buildRuntimeDialog.validation && (
                                        <div className={`p-4 rounded-md ${
                                            buildRuntimeDialog.validation.valid
                                                ? 'bg-green-900/30 border border-green-700'
                                                : 'bg-red-900/30 border border-red-700'
                                        }`}>
                                            <div className="flex items-center mb-2">
                                                {buildRuntimeDialog.validation.valid ? (
                                                    <CheckCircle className="h-5 w-5 text-green-400 mr-2"/>
                                                ) : (
                                                    <AlertCircle className="h-5 w-5 text-red-400 mr-2"/>
                                                )}
                                                <span className={`font-medium ${
                                                    buildRuntimeDialog.validation.valid ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                    {buildRuntimeDialog.validation.message || (buildRuntimeDialog.validation.valid ? 'Valid' : 'Invalid')}
                                                </span>
                                            </div>

                                            {/* Errors */}
                                            {buildRuntimeDialog.validation.errors?.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-sm font-medium text-red-400 mb-1">Errors:</p>
                                                    <ul className="text-sm text-red-300 list-disc list-inside">
                                                        {buildRuntimeDialog.validation.errors.map((err, i) => (
                                                            <li key={i}>{err}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Warnings */}
                                            {buildRuntimeDialog.validation.warnings?.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-sm font-medium text-yellow-400 mb-1">Warnings:</p>
                                                    <ul className="text-sm text-yellow-300 list-disc list-inside">
                                                        {buildRuntimeDialog.validation.warnings.map((warn, i) => (
                                                            <li key={i}>{warn}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Spec Info */}
                                            {buildRuntimeDialog.validation.specInfo && (
                                                <div className="mt-4 pt-4 border-t border-gray-600">
                                                    <p className="text-sm font-medium text-gray-300 mb-2">Runtime Info:</p>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-gray-400">Name:</span>
                                                            <span className="ml-2 text-gray-200">{buildRuntimeDialog.validation.specInfo.name}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">Version:</span>
                                                            <span className="ml-2 text-gray-200">{buildRuntimeDialog.validation.specInfo.version}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">Language:</span>
                                                            <span className="ml-2 text-gray-200">{buildRuntimeDialog.validation.specInfo.language} {buildRuntimeDialog.validation.specInfo.languageVersion}</span>
                                                        </div>
                                                        {buildRuntimeDialog.validation.specInfo.requiresGpu && (
                                                            <div>
                                                                <span className="text-yellow-400">Requires GPU</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {buildRuntimeDialog.validation.specInfo.description && (
                                                        <p className="mt-2 text-sm text-gray-400">
                                                            {buildRuntimeDialog.validation.specInfo.description}
                                                        </p>
                                                    )}
                                                    {buildRuntimeDialog.validation.specInfo.pipPackages?.length > 0 && (
                                                        <div className="mt-2">
                                                            <span className="text-sm text-gray-400">Pip packages: </span>
                                                            <span className="text-sm text-gray-200">
                                                                {buildRuntimeDialog.validation.specInfo.pipPackages.slice(0, 5).join(', ')}
                                                                {buildRuntimeDialog.validation.specInfo.pipPackages.length > 5 && ` +${buildRuntimeDialog.validation.specInfo.pipPackages.length - 5} more`}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {buildRuntimeDialog.validation.specInfo.npmPackages?.length > 0 && (
                                                        <div className="mt-1">
                                                            <span className="text-sm text-gray-400">NPM packages: </span>
                                                            <span className="text-sm text-gray-200">
                                                                {buildRuntimeDialog.validation.specInfo.npmPackages.join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Help Text */}
                                    {!buildRuntimeDialog.validation && (
                                        <div className="p-4 rounded-md bg-gray-700/50 text-sm text-gray-400">
                                            <p className="font-medium text-gray-300 mb-2">YAML Schema (v1.0):</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                <li><code className="text-purple-400">schema_version</code>: "1.0"</li>
                                                <li><code className="text-purple-400">name</code>: Runtime identifier</li>
                                                <li><code className="text-purple-400">version</code>: Version string (e.g., 1.0.0)</li>
                                                <li><code className="text-purple-400">description</code>: Runtime description</li>
                                                <li><code className="text-purple-400">base.language</code>: python, node, java</li>
                                                <li><code className="text-purple-400">base.version</code>: Language version</li>
                                                <li><code className="text-purple-400">pip</code>: Python packages list</li>
                                                <li><code className="text-purple-400">npm</code>: NPM packages list</li>
                                                <li><code className="text-purple-400">environment</code>: Environment variables</li>
                                                <li><code className="text-purple-400">hooks.pre_install</code>: Pre-install script</li>
                                                <li><code className="text-purple-400">hooks.post_install</code>: Post-install script</li>
                                                <li><code className="text-purple-400">gpu.required</code>: GPU requirement</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex-shrink-0 p-6 pt-4 border-t border-gray-700">
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={closeBuildRuntimeDialog}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={buildRuntimeFromYAML}
                                    disabled={!buildRuntimeDialog.yamlContent.trim() || buildRuntimeDialog.validating}
                                    className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed"
                                >
                                    <Cpu className="h-4 w-4 mr-2"/>
                                    {buildRuntimeDialog.dryRun ? 'Validate Only' : 'Build Runtime'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Runtime Details Dialog */}
            {runtimeDetailsDialog.show && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div
                        className="relative top-16 mx-auto p-5 border w-11/12 max-w-[90vw] min-h-[80vh] shadow-lg rounded-md bg-white dark:bg-gray-800">
                        <div className="flex items-center justify-between pb-3 border-b">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                Runtime Details - {runtimeDetailsDialog.details?.name || 'Loading...'}
                            </h3>
                            <button
                                onClick={closeRuntimeDetails}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-5 w-5"/>
                            </button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="border-b border-gray-200 dark:border-gray-600">
                            <nav className="flex space-x-8">
                                <button
                                    onClick={() => setRuntimeDetailsDialog(prev => ({...prev, activeTab: 'details'}))}
                                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                        runtimeDetailsDialog.activeTab === 'details'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setRuntimeDetailsDialog(prev => ({...prev, activeTab: 'packages'}))}
                                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                        runtimeDetailsDialog.activeTab === 'packages'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Packages ({runtimeDetailsDialog.details?.packages?.length || 0})
                                </button>
                                <button
                                    onClick={() => setRuntimeDetailsDialog(prev => ({...prev, activeTab: 'yaml'}))}
                                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                        runtimeDetailsDialog.activeTab === 'yaml'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                                >
                                    YAML Definition
                                </button>
                            </nav>
                        </div>

                        <div className="py-4">
                            {runtimeDetailsDialog.loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading runtime details...</span>
                                </div>
                            ) : runtimeDetailsDialog.error ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 dark:text-gray-400">Failed to load runtime details</p>
                                    <p className="text-red-500 mt-2">{runtimeDetailsDialog.error}</p>
                                </div>
                            ) : runtimeDetailsDialog.details && (
                                <>
                                    {/* Details Tab */}
                                    {runtimeDetailsDialog.activeTab === 'details' && (
                                        <div className="space-y-6">
                                            {/* Basic Information */}
                                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
                                                <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{runtimeDetailsDialog.details.name}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">v{runtimeDetailsDialog.details.version || 'N/A'}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Language</dt>
                                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{runtimeDetailsDialog.details.language}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Language Version</dt>
                                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{runtimeDetailsDialog.details.languageVersion || 'N/A'}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</dt>
                                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatSize(runtimeDetailsDialog.details.sizeBytes)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                                                        <dd className="mt-1">
                                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                                runtimeDetailsDialog.details.available
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {runtimeDetailsDialog.details.available ? 'Available' : 'Not Available'}
                                                            </span>
                                                        </dd>
                                                    </div>
                                                    {runtimeDetailsDialog.details.description && (
                                                        <div className="col-span-2">
                                                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                                                            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{runtimeDetailsDialog.details.description}</dd>
                                                        </div>
                                                    )}
                                                </dl>
                                            </div>

                                            {/* Build Info */}
                                            {runtimeDetailsDialog.details.buildInfo && (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Build Information</h4>
                                                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {runtimeDetailsDialog.details.buildInfo.builtAt && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Built At</dt>
                                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                                                    {new Date(runtimeDetailsDialog.details.buildInfo.builtAt).toLocaleString()}
                                                                </dd>
                                                            </div>
                                                        )}
                                                        {runtimeDetailsDialog.details.buildInfo.platform && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Platform</dt>
                                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{runtimeDetailsDialog.details.buildInfo.platform}</dd>
                                                            </div>
                                                        )}
                                                        {runtimeDetailsDialog.details.buildInfo.builtWith && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Builder</dt>
                                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">{runtimeDetailsDialog.details.buildInfo.builtWith}</dd>
                                                            </div>
                                                        )}
                                                    </dl>
                                                </div>
                                            )}

                                            {/* Requirements */}
                                            {runtimeDetailsDialog.details.requirements && (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Requirements</h4>
                                                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {runtimeDetailsDialog.details.requirements.architectures?.length > 0 && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Architectures</dt>
                                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                                                                    {runtimeDetailsDialog.details.requirements.architectures.join(', ')}
                                                                </dd>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">GPU Required</dt>
                                                            <dd className="mt-1">
                                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                                    runtimeDetailsDialog.details.requirements.gpu
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : 'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                    {runtimeDetailsDialog.details.requirements.gpu ? 'Yes' : 'No'}
                                                                </span>
                                                            </dd>
                                                        </div>
                                                        {runtimeDetailsDialog.details.timeout && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout</dt>
                                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                                                    {runtimeDetailsDialog.details.timeout}
                                                                </dd>
                                                            </div>
                                                        )}
                                                    </dl>
                                                </div>
                                            )}

                                            {/* Hooks */}
                                            {runtimeDetailsDialog.details.hooks && (runtimeDetailsDialog.details.hooks.preInstall || runtimeDetailsDialog.details.hooks.postInstall) && (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Hooks</h4>
                                                    <div className="space-y-4">
                                                        {runtimeDetailsDialog.details.hooks.preInstall && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Pre-Install</dt>
                                                                <dd className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                                                                    <pre className="font-mono text-sm whitespace-pre-wrap break-words">
                                                                        {runtimeDetailsDialog.details.hooks.preInstall}
                                                                    </pre>
                                                                </dd>
                                                            </div>
                                                        )}
                                                        {runtimeDetailsDialog.details.hooks.postInstall && (
                                                            <div>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Post-Install</dt>
                                                                <dd className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                                                                    <pre className="font-mono text-sm whitespace-pre-wrap break-words">
                                                                        {runtimeDetailsDialog.details.hooks.postInstall}
                                                                    </pre>
                                                                </dd>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Environment Variables */}
                                            {runtimeDetailsDialog.details.environment && Object.keys(runtimeDetailsDialog.details.environment).length > 0 && (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Environment Variables</h4>
                                                    <dl className="space-y-2">
                                                        {Object.entries(runtimeDetailsDialog.details.environment).map(([key, value]) => (
                                                            <div key={key}>
                                                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 font-mono">{key}</dt>
                                                                <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono break-all">{value}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                </div>
                                            )}

                                            {/* Libraries */}
                                            {runtimeDetailsDialog.details.libraries?.length > 0 && (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Libraries</h4>
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {runtimeDetailsDialog.details.libraries.map((lib, index) => (
                                                            <li key={index} className="text-sm text-gray-900 dark:text-white font-mono">{lib}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Packages Tab */}
                                    {runtimeDetailsDialog.activeTab === 'packages' && (
                                        <div className="space-y-6">
                                            {runtimeDetailsDialog.details.packages?.length > 0 ? (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                                        Installed Packages ({runtimeDetailsDialog.details.packages.length})
                                                    </h4>
                                                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                                                        <div className="font-mono text-sm space-y-1">
                                                            {runtimeDetailsDialog.details.packages.map((pkg, index) => (
                                                                <div key={index}>{pkg}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <p className="text-gray-500 dark:text-gray-400">No packages installed</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* YAML Tab */}
                                    {runtimeDetailsDialog.activeTab === 'yaml' && (
                                        <div className="space-y-6">
                                            {runtimeDetailsDialog.details.originalYaml ? (
                                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">YAML Definition</h4>
                                                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                                                        <pre className="font-mono text-sm whitespace-pre-wrap break-words">
                                                            {runtimeDetailsDialog.details.originalYaml}
                                                        </pre>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <p className="text-gray-500 dark:text-gray-400">No YAML definition available</p>
                                                    <p className="text-sm text-gray-400 mt-1">This runtime may have been created without a YAML file</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Runtimes;