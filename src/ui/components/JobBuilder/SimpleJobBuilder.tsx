import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {JobConfig, JobExecuteRequest} from '../../types/job';
import {CommandBuilder} from '../../services/commandBuilder';
import {useJobs} from '../../hooks/useJobs';
import {File, FolderPlus, Play, RotateCcw, Trash2, Upload} from 'lucide-react';
import clsx from 'clsx';
import {UploadedFile, UploadService} from '../../services/uploadService';
import {apiService} from '../../services/apiService';

// TODO: Add ResourceAvailability component

interface Runtime {
    id: string;
    name: string;
    version: string;
    size: string;
    description: string;
}

// RNX schedule format validation function
const isValidScheduleFormat = (schedule: string): boolean => {
    if (!schedule.trim()) return true; // Empty is valid (immediate execution)

    const trimmed = schedule.trim();

    // Check for duration format (e.g., "30s", "5min", "2h", "1d", "2h30m")
    const durationRegex = /^\d+[smhd]$|^\d+min$|^\d+h\d+m$/;
    if (durationRegex.test(trimmed)) {
        return true;
    }

    // Check for RFC3339 timestamp format
    const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/;
    if (rfc3339Regex.test(trimmed)) {
        // Try to parse as valid date
        try {
            const date = new Date(trimmed);
            return !isNaN(date.getTime());
        } catch {
            return false;
        }
    }

    return false;
};


interface SimpleJobBuilderProps {
    onJobCreated?: (jobId: string) => void;
    onClose?: () => void;
    showHeader?: boolean;
}

export const SimpleJobBuilder: React.FC<SimpleJobBuilderProps> = ({
                                                                      onJobCreated,
                                                                      onClose,
                                                                      showHeader = true
                                                                  }) => {
    const {t} = useTranslation();
    const {executeJob, loading} = useJobs();
    const [config, setConfig] = useState<JobConfig>({
        command: '',
        files: [],
        directories: [],
        maxCpu: 0,
        maxMemory: 0,
        cpuCores: '',
        maxIobps: 0,
        runtime: '',
        network: 'bridge',
        volumes: [],
        envVars: {},
        secretEnvVars: {},
        schedule: '',
        gpuCount: 0,
        gpuMemoryMb: 0
    });

    const [preview, setPreview] = useState<string>('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [uploadError, setUploadError] = useState<string>('');
    const [isDragOver, setIsDragOver] = useState<boolean>(false);
    const [runtimes, setRuntimes] = useState<Runtime[]>([]);
    const [loadingRuntimes, setLoadingRuntimes] = useState(true);
    const [networks, setNetworks] = useState<Array<{ id: string; name: string; type: string }>>([]);
    const [loadingNetworks, setLoadingNetworks] = useState(true);
    const [volumes, setVolumes] = useState<Array<{ id?: string; name: string; size: string; type: string }>>([]);
    const [loadingVolumes, setLoadingVolumes] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dirInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    const updateConfig = useCallback((updates: Partial<JobConfig>) => {
        setConfig(prev => ({...prev, ...updates}));
    }, []);

    const updateEnvVar = useCallback((key: string, value: string) => {
        setConfig(prev => ({
            ...prev,
            envVars: {...prev.envVars, [key]: value}
        }));
    }, []);

    const removeEnvVar = useCallback((key: string) => {
        setConfig(prev => {
            const newEnvVars = {...prev.envVars};
            delete newEnvVars[key];
            return {...prev, envVars: newEnvVars};
        });
    }, []);

    const updateSecretEnvVar = useCallback((key: string, value: string) => {
        setConfig(prev => ({
            ...prev,
            secretEnvVars: {...prev.secretEnvVars, [key]: value}
        }));
    }, []);

    const removeSecretEnvVar = useCallback((key: string) => {
        setConfig(prev => {
            const newSecretEnvVars = {...prev.secretEnvVars};
            delete newSecretEnvVars[key];
            return {...prev, secretEnvVars: newSecretEnvVars};
        });
    }, []);

    const toggleVolume = useCallback((volumeName: string) => {
        setConfig(prev => ({
            ...prev,
            volumes: prev.volumes.includes(volumeName)
                ? prev.volumes.filter(v => v !== volumeName)
                : [...prev.volumes, volumeName]
        }));
    }, []);

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploadError('');
        const validFiles: File[] = [];

        // Validate files
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!UploadService.validateFileSize(file)) {
                setUploadError(`File ${file.name} exceeds 100MB limit`);
                continue;
            }
            if (!UploadService.isAllowedFileType(file)) {
                setUploadError(`File type not allowed: ${file.name}`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) return;

        try {
            // Upload files
            const result = await UploadService.uploadBatch(validFiles);
            setUploadedFiles(prev => [...prev, ...result.uploads]);

            // Update config with file paths
            const filePaths = result.uploads.map(f => f.path);
            setConfig(prev => ({
                ...prev,
                files: [...prev.files, ...filePaths]
            }));
        } catch (error) {
            setUploadError(`Upload failed: ${error}`);
        }
    }, []);

    const handleDirectoryUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploadError('');

        try {
            const result = await UploadService.uploadDirectory(files);
            setUploadedFiles(prev => [...prev, ...result.uploads]);

            // Update config with directory path
            setConfig(prev => ({
                ...prev,
                directories: [...prev.directories, result.path]
            }));
        } catch (error) {
            setUploadError(`Directory upload failed: ${error}`);
        }
    }, []);

    const removeUploadedFile = useCallback((fileId: string) => {
        const file = uploadedFiles.find(f => f.id === fileId);
        if (!file) return;

        // Remove from uploaded files
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));

        // Remove from config
        setConfig(prev => ({
            ...prev,
            files: prev.files.filter(f => f !== file.path)
        }));

        // Clean up on server
        UploadService.cleanup(fileId).catch(console.error);
    }, [uploadedFiles]);

    // Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragOver to false if we're leaving the drop zone entirely
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            // Check if this looks like a directory structure (files have path separators)
            const hasDirectoryStructure = Array.from(files).some(file => {
                const fileWithPath = file as File & { webkitRelativePath?: string };
                return fileWithPath.webkitRelativePath && fileWithPath.webkitRelativePath.includes('/');
            });

            if (hasDirectoryStructure) {
                handleDirectoryUpload(files);
            } else {
                handleFileUpload(files);
            }
        }
    }, [handleFileUpload, handleDirectoryUpload]);

    const updatePreview = useCallback(() => {
        try {
            const generated = CommandBuilder.fromJobConfig(config);
            setPreview(generated.fullCommand);
        } catch (error) {
            setPreview('# Error generating command preview');
        }
    }, [config]);

    useEffect(() => {
        updatePreview();
    }, [updatePreview]);

    useEffect(() => {
        const fetchRuntimes = async () => {
            try {
                setLoadingRuntimes(true);
                const response = await apiService.getRuntimes();
                setRuntimes(response.runtimes || []);
            } catch (error) {
                console.error('Failed to fetch runtimes:', error);
            } finally {
                setLoadingRuntimes(false);
            }
        };

        const fetchNetworks = async () => {
            try {
                setLoadingNetworks(true);
                const response = await apiService.getNetworks();
                setNetworks(response.networks || []);
            } catch (error) {
                console.error('Failed to fetch networks:', error);
            } finally {
                setLoadingNetworks(false);
            }
        };

        const fetchVolumes = async () => {
            try {
                setLoadingVolumes(true);
                const response = await apiService.getVolumes();
                setVolumes(response.volumes || []);
            } catch (error) {
                console.error('Failed to fetch volumes:', error);
            } finally {
                setLoadingVolumes(false);
            }
        };

        fetchRuntimes();
        fetchNetworks();
        fetchVolumes();
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!config.command.trim()) {
            alert(t('jobBuilder.commandRequired'));
            return;
        }

        // Validate CPU limit (must be 0 or >= 10)
        if (config.maxCpu > 0 && config.maxCpu < 10) {
            alert('CPU limit must be either 0 (unlimited) or at least 10%');
            return;
        }

        // Validate Memory limit (must be 0 or >= 1)
        if (config.maxMemory > 0 && config.maxMemory < 1) {
            alert('Memory limit must be either 0 (unlimited) or at least 1 MB');
            return;
        }

        try {
            // Parse command into command and args (like shell does)
            const commandParts = config.command.trim().split(/\s+/);
            const command = commandParts[0];
            const args = commandParts.slice(1);

            const request: JobExecuteRequest = {
                command: command,
                args: args.length > 0 ? args : undefined,
                maxCPU: config.maxCpu || undefined,
                maxMemory: config.maxMemory || undefined,
                maxIOBPS: config.maxIobps || undefined,
                cpuCores: config.cpuCores || undefined,
                runtime: config.runtime || undefined,
                network: config.network,
                volumes: config.volumes,
                uploads: config.files, // These are now actual file paths from upload handler
                uploadDirs: config.directories, // These are now actual directory paths
                envVars: config.envVars,
                secretEnvVars: config.secretEnvVars,
                schedule: config.schedule || undefined,
                gpuCount: config.gpuCount || undefined,
                gpuMemoryMb: config.gpuMemoryMb || undefined
            };

            const jobId = await executeJob(request);
            onJobCreated?.(jobId);

            // Reset form
            setConfig({
                command: '',
                files: [],
                directories: [],
                maxCpu: 0,
                maxMemory: 0,
                cpuCores: '',
                maxIobps: 0,
                runtime: '',
                network: 'bridge',
                volumes: [],
                envVars: {},
                secretEnvVars: {},
                schedule: '',
                gpuCount: 0,
                gpuMemoryMb: 0
            });
            setUploadedFiles([]);
            setUploadError('');
        } catch (error) {
            alert(`${t('jobBuilder.failedToCreate')}: ${error instanceof Error ? error.message : t('jobBuilder.unknownError')}`);
        }
    }, [config, executeJob, onJobCreated]);

    const resetForm = useCallback(() => {
        setConfig({
            command: '',
            files: [],
            directories: [],
            maxCpu: 0,
            maxMemory: 0,
            cpuCores: '',
            maxIobps: 0,
            runtime: '',
            network: 'bridge',
            volumes: [],
            envVars: {},
            secretEnvVars: {},
            schedule: '',
            gpuCount: 0,
            gpuMemoryMb: 0
        });
    }, []);

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                {showHeader && (
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('jobBuilder.createTitle')}</h2>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">
                        {/* System Resource Availability */}
                        {/* TODO: Add ResourceAvailability component */}

                        {/* Basic Configuration */}
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                {t('jobBuilder.command')} *
                            </label>
                            <input
                                type="text"
                                value={config.command}
                                onChange={(e) => updateConfig({command: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={t('jobBuilder.commandPlaceholder')}
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                {t('jobBuilder.commandHelp')}
                            </p>
                        </div>


                        {/* File Uploads */}
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                {t('jobBuilder.filesAndDirs')}
                            </label>
                            <div
                                ref={dropZoneRef}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                className={clsx(
                                    "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200",
                                    isDragOver
                                        ? "border-blue-400 bg-blue-50 scale-[1.02]"
                                        : "border-gray-300 hover:border-gray-400"
                                )}
                            >
                                <Upload className={clsx(
                                    "w-8 h-8 mx-auto mb-2 transition-colors",
                                    isDragOver ? "text-blue-500" : "text-gray-400"
                                )}/>
                                <p className={clsx(
                                    "text-sm mb-2 transition-colors",
                                    isDragOver ? "text-blue-700 font-medium" : "text-gray-600"
                                )}>
                                    {isDragOver
                                        ? "Release to upload files..."
                                        : "Drop files or directories here, or click to browse"
                                    }
                                </p>
                                <div className="space-x-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        onChange={(e) => handleFileUpload(e.target.files)}
                                        className="hidden"
                                        accept=".py,.js,.ts,.sh,.yaml,.yml,.json,.txt,.csv,.parquet,.h5,.tar,.gz,.zip"
                                    />
                                    <input
                                        ref={dirInputRef}
                                        type="file"
                                        {...{
                                            webkitdirectory: "true",
                                            directory: "true"
                                        } as React.InputHTMLAttributes<HTMLInputElement>}
                                        multiple
                                        onChange={(e) => handleDirectoryUpload(e.target.files)}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                                    >
                                        <Upload className="w-4 h-4 mr-1"/>
                                        Add Files
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dirInputRef.current?.click()}
                                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                                    >
                                        <FolderPlus className="w-4 h-4 mr-1"/>
                                        Add Directory
                                    </button>
                                </div>

                                {/* Upload Error */}
                                {uploadError && (
                                    <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                                        {uploadError}
                                    </div>
                                )}

                                {/* Uploaded Files List */}
                                {uploadedFiles.length > 0 && (
                                    <div className="mt-4 text-left space-y-2">
                                        <p className="text-xs text-gray-500 font-medium">Uploaded Files:</p>
                                        {uploadedFiles.map((file) => (
                                            <div key={file.id}
                                                 className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                                <div className="flex items-center space-x-2">
                                                    <File className="w-4 h-4 text-gray-400"/>
                                                    <span className="text-gray-700">{file.name}</span>
                                                    <span className="text-xs text-gray-500">
                            ({UploadService.formatFileSize(file.size)})
                          </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeUploadedFile(file.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Resource Limits */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-500 mb-4">{t('jobBuilder.resourceLimits')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        CPU Limit (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.maxCpu || ''}
                                        onChange={(e) => updateConfig({maxCpu: parseInt(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="200"
                                        min="0"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        CPU limit as percentage (200% = 2 cores). Minimum: 10% or 0 (unlimited)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Memory Limit (MB)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.maxMemory || ''}
                                        onChange={(e) => updateConfig({maxMemory: parseInt(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="2048"
                                        min="0"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Memory limit in megabytes. Minimum: 1 MB or 0 (unlimited)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        CPU Cores
                                    </label>
                                    <input
                                        type="text"
                                        value={config.cpuCores}
                                        onChange={(e) => updateConfig({cpuCores: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0-3"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        CPU cores to use (e.g., "0-3" or "0,2,4")
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        I/O Limit (bytes/sec)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.maxIobps || ''}
                                        onChange={(e) => updateConfig({maxIobps: parseInt(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="10485760"
                                        min="0"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        I/O bandwidth limit in bytes per second
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        GPU Count
                                    </label>
                                    <input
                                        type="number"
                                        value={config.gpuCount || ''}
                                        onChange={(e) => updateConfig({gpuCount: parseInt(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                        min="0"
                                        max="8"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Number of GPUs to request (0 = no GPU)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        GPU Memory (MB)
                                    </label>
                                    <input
                                        type="number"
                                        value={config.gpuMemoryMb || ''}
                                        onChange={(e) => updateConfig({gpuMemoryMb: parseInt(e.target.value) || 0})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                        min="0"
                                        disabled={!config.gpuCount || config.gpuCount === 0}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        GPU memory limit in megabytes (0 = no limit)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Environment */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-500 mb-4">{t('jobBuilder.environment')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Runtime
                                    </label>
                                    <select
                                        value={config.runtime}
                                        onChange={(e) => updateConfig({runtime: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={loadingRuntimes}
                                    >
                                        <option value="">Default</option>
                                        {runtimes.map((runtime) => (
                                            <option key={runtime.id} value={runtime.name}>
                                                {runtime.name} {runtime.version && `(${runtime.version})`}
                                            </option>
                                        ))}
                                    </select>
                                    {loadingRuntimes && (
                                        <p className="mt-1 text-xs text-gray-500">Loading available runtimes...</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white mb-2">
                                        Network
                                    </label>
                                    <select
                                        value={config.network}
                                        onChange={(e) => updateConfig({network: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={loadingNetworks}
                                    >
                                        {loadingNetworks ? (
                                            <option value="">Loading networks...</option>
                                        ) : (
                                            <>
                                                {/* Default built-in networks */}
                                                <option value="bridge">bridge (default)</option>
                                                <option value="host">host</option>
                                                <option value="none">none</option>

                                                {/* Custom networks */}
                                                {networks
                                                    .filter(net => !['bridge', 'host', 'none'].includes(net.name))
                                                    .map(network => (
                                                        <option key={network.id || network.name} value={network.name}>
                                                            {network.name}
                                                        </option>
                                                    ))
                                                }
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Volumes */}
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                Volumes
                            </label>
                            {loadingVolumes ? (
                                <p className="text-sm text-gray-400">Loading available volumes...</p>
                            ) : volumes.length === 0 ? (
                                <p className="text-sm text-gray-400">No volumes available. Create volumes in the
                                    Resources page.</p>
                            ) : (
                                <div
                                    className="border border-gray-600 bg-gray-800 rounded-md p-3 max-h-48 overflow-y-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {volumes.map((volume) => (
                                            <label
                                                key={volume.id || volume.name}
                                                className="flex items-start space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={config.volumes.includes(volume.name)}
                                                    onChange={() => toggleVolume(volume.name)}
                                                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-white truncate">
                                                        {volume.name}
                                                    </div>
                                                    <div className="text-xs text-gray-400 truncate">
                                                        {volume.size} • {volume.type}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {config.volumes.length > 0 && (
                                <div className="mt-2 text-xs text-gray-400">
                                    Selected ({config.volumes.length}): {config.volumes.join(', ')}
                                </div>
                            )}
                        </div>

                        {/* Advanced Options */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                            </button>

                            {showAdvanced && (
                                <div className="mt-4 space-y-4 pt-4 border-t border-gray-200">

                                    <div>
                                        <label className="block text-sm font-medium text-white mb-2">
                                            Schedule (Duration or RFC3339 time)
                                        </label>
                                        <input
                                            type="text"
                                            value={config.schedule}
                                            onChange={(e) => updateConfig({schedule: e.target.value})}
                                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                                config.schedule && !isValidScheduleFormat(config.schedule)
                                                    ? 'border-red-300 focus:ring-red-500 bg-red-50 text-red-900'
                                                    : 'border-gray-300 focus:ring-blue-500 bg-white text-gray-900'
                                            }`}
                                            placeholder="30min (run in 30 minutes)"
                                        />
                                        <div className="mt-1 space-y-1">
                                            <p className="text-xs text-gray-500">
                                                Leave empty to run immediately. Use duration or RFC3339 timestamp
                                                format.
                                            </p>
                                            {config.schedule && !isValidScheduleFormat(config.schedule) && (
                                                <p className="text-xs text-red-500">
                                                    Invalid format. Use duration (e.g., 30min, 2h, 2h30m) or RFC3339
                                                    timestamp (e.g., 2025-08-03T15:00:00Z)
                                                </p>
                                            )}
                                            <div className="text-xs text-gray-400 space-y-1">
                                                <div>
                                                    Duration examples:
                                                    <span className="font-mono ml-1">30s</span>,
                                                    <span className="font-mono ml-1">5min</span>,
                                                    <span className="font-mono ml-1">2h</span>,
                                                    <span className="font-mono ml-1">2h30m</span>
                                                </div>
                                                <div>
                                                    Timestamp examples:
                                                    <span className="font-mono ml-1">2025-08-03T15:00:00Z</span>,
                                                    <span className="font-mono ml-1">2025-08-03T15:00:00-07:00</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-white mb-2">
                                            Environment Variables
                                        </label>
                                        {Object.entries(config.envVars).map(([key, value]) => (
                                            <div key={key} className="flex space-x-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={key}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-800 text-gray-500 font-medium"
                                                    disabled
                                                />
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => updateEnvVar(key, e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeEnvVar(key)}
                                                    className="px-3 py-2 text-red-600 hover:text-red-800"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                placeholder="KEY"
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const keyInput = e.target as HTMLInputElement;
                                                        const valueInput = keyInput.nextElementSibling as HTMLInputElement;
                                                        if (keyInput.value && valueInput.value) {
                                                            updateEnvVar(keyInput.value, valueInput.value);
                                                            keyInput.value = '';
                                                            valueInput.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <input
                                                type="text"
                                                placeholder="value"
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const valueInput = e.target as HTMLInputElement;
                                                        const keyInput = valueInput.previousElementSibling as HTMLInputElement;
                                                        if (keyInput.value && valueInput.value) {
                                                            updateEnvVar(keyInput.value, valueInput.value);
                                                            keyInput.value = '';
                                                            valueInput.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const valueInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                    const keyInput = valueInput.previousElementSibling as HTMLInputElement;
                                                    if (keyInput.value && valueInput.value) {
                                                        updateEnvVar(keyInput.value, valueInput.value);
                                                        keyInput.value = '';
                                                        valueInput.value = '';
                                                    }
                                                }}
                                                className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Secret Environment Variables */}
                                    <div>
                                        <label className="block text-sm font-medium text-white mb-2 flex items-center">
                                            <span>Secret Environment Variables</span>
                                            <span
                                                className="ml-2 text-xs text-yellow-400 bg-yellow-900 px-2 py-1 rounded">Hidden from logs</span>
                                        </label>
                                        {Object.entries(config.secretEnvVars).map(([key, value]) => (
                                            <div key={key} className="flex space-x-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={key}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-800 font-medium"
                                                    disabled
                                                />
                                                <input
                                                    type="password"
                                                    value={value}
                                                    onChange={(e) => updateSecretEnvVar(key, e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-yellow-500 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-yellow-50"
                                                    placeholder="Hidden value"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeSecretEnvVar(key)}
                                                    className="px-3 py-2 text-red-600 hover:text-red-800"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                placeholder="SECRET_KEY"
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const keyInput = e.currentTarget;
                                                        const valueInput = keyInput.nextElementSibling as HTMLInputElement;
                                                        if (keyInput.value && valueInput.value) {
                                                            updateSecretEnvVar(keyInput.value, valueInput.value);
                                                            keyInput.value = '';
                                                            valueInput.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <input
                                                type="password"
                                                placeholder="secret_value"
                                                className="flex-1 px-3 py-2 border border-yellow-500 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-yellow-50"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const valueInput = e.currentTarget;
                                                        const keyInput = valueInput.previousElementSibling as HTMLInputElement;
                                                        if (keyInput.value && valueInput.value) {
                                                            updateSecretEnvVar(keyInput.value, valueInput.value);
                                                            keyInput.value = '';
                                                            valueInput.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const valueInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                    const keyInput = valueInput.previousElementSibling as HTMLInputElement;
                                                    if (keyInput.value && valueInput.value) {
                                                        updateSecretEnvVar(keyInput.value, valueInput.value);
                                                        keyInput.value = '';
                                                        valueInput.value = '';
                                                    }
                                                }}
                                                className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                                            >
                                                Add Secret
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Command Preview */}
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                Command Preview
                            </label>
                            <pre
                                className="bg-gray-900 text-green-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
                {preview || '# Configure job options to see command preview'}
              </pre>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-between pt-4 border-t border-gray-200">
                            <div className="space-x-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2"/>
                                    {t('jobBuilder.reset')}
                                </button>
                            </div>

                            <div className="space-x-2">
                                <button
                                    type="submit"
                                    disabled={loading || !config.command.trim()}
                                    className={clsx(
                                        'inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white',
                                        loading || !config.command.trim()
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                    )}
                                >
                                    <Play className="w-4 h-4 mr-2"/>
                                    {loading ? t('jobBuilder.creating') : t('jobBuilder.executeJob')}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};