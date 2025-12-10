import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {HardDrive, Network, Plus, RefreshCw, Trash2, X} from 'lucide-react';
import {apiService} from '../services/apiService';
import {useNode} from '../contexts/NodeContext';

interface Volume {
    id?: string;
    name: string;
    size: string;
    type: string;
    created_time?: string;
    mountPath?: string;
}

interface NetworkResource {
    id: string;
    name: string;
    type: string;
    subnet?: string;
    cidr?: string;
}

const Resources: React.FC = () => {
    const {t} = useTranslation();
    const {selectedNode} = useNode();
    const [volumes, setVolumes] = useState<Volume[]>([]);
    const [networks, setNetworks] = useState<NetworkResource[]>([]);
    const [loading, setLoading] = useState({
        volumes: true,
        networks: true
    });
    const [error, setError] = useState({
        volumes: '',
        networks: ''
    });
    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        volumeName: string;
        deleting: boolean;
    }>({
        show: false,
        volumeName: '',
        deleting: false
    });

    const [deleteNetworkConfirm, setDeleteNetworkConfirm] = useState<{
        show: boolean;
        networkName: string;
        deleting: boolean;
    }>({
        show: false,
        networkName: '',
        deleting: false
    });

    const [createVolumeModal, setCreateVolumeModal] = useState({
        show: false,
        creating: false
    });

    const [createNetworkModal, setCreateNetworkModal] = useState({
        show: false,
        creating: false
    });

    const [volumeForm, setVolumeForm] = useState({
        name: '',
        size: '',
        type: 'filesystem'
    });

    const [volumeFormErrors, setVolumeFormErrors] = useState({
        name: '',
        size: ''
    });

    const [networkForm, setNetworkForm] = useState({
        name: '',
        cidr: ''
    });

    const fetchVolumes = async () => {
        try {
            setLoading(prev => ({...prev, volumes: true}));
            setError(prev => ({...prev, volumes: ''}));
            const response = await apiService.getVolumes();
            setVolumes(response.volumes || []);
        } catch (err) {
            setError(prev => ({...prev, volumes: err instanceof Error ? err.message : 'Failed to fetch volumes'}));
        } finally {
            setLoading(prev => ({...prev, volumes: false}));
        }
    };

    const fetchNetworks = async () => {
        try {
            setLoading(prev => ({...prev, networks: true}));
            setError(prev => ({...prev, networks: ''}));
            const response = await apiService.getNetworks();
            setNetworks(response.networks || []);
        } catch (err) {
            setError(prev => ({...prev, networks: err instanceof Error ? err.message : 'Failed to fetch networks'}));
        } finally {
            setLoading(prev => ({...prev, networks: false}));
        }
    };

    const refreshAll = () => {
        fetchVolumes();
        fetchNetworks();
    };

    const handleDeleteVolume = async (volumeName: string) => {
        setDeleteConfirm({show: true, volumeName, deleting: false});
    };

    const handleDeleteNetwork = (networkName: string) => {
        setDeleteNetworkConfirm({show: true, networkName, deleting: false});
    };

    const confirmDeleteNetwork = async () => {
        if (!deleteNetworkConfirm.networkName) return;

        setDeleteNetworkConfirm(prev => ({...prev, deleting: true}));

        try {
            await apiService.deleteNetwork(deleteNetworkConfirm.networkName);
            setDeleteNetworkConfirm({show: false, networkName: '', deleting: false});
            await fetchNetworks();
        } catch (err) {
            console.error('Failed to delete network:', err);
            setError(prev => ({
                ...prev,
                networks: err instanceof Error ? err.message : 'Failed to delete network'
            }));
            setDeleteNetworkConfirm(prev => ({...prev, deleting: false}));
        }
    };

    const cancelDeleteNetwork = () => {
        setDeleteNetworkConfirm({show: false, networkName: '', deleting: false});
    };

    const confirmDeleteVolume = async () => {
        if (!deleteConfirm.volumeName) return;

        setDeleteConfirm(prev => ({...prev, deleting: true}));

        try {
            await apiService.deleteVolume(deleteConfirm.volumeName);
            setDeleteConfirm({show: false, volumeName: '', deleting: false});
            await fetchVolumes();
        } catch (err) {
            console.error('Failed to delete volume:', err);
            setError(prev => ({
                ...prev,
                volumes: err instanceof Error ? err.message : 'Failed to delete volume'
            }));
            setDeleteConfirm(prev => ({...prev, deleting: false}));
        }
    };

    const cancelDeleteVolume = () => {
        setDeleteConfirm({show: false, volumeName: '', deleting: false});
    };

    // Validation functions
    const validateVolumeName = (name: string): string => {
        if (!name) return 'Volume name is required';
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(name)) {
            return 'Name must start with alphanumeric and contain only letters, numbers, hyphens, and underscores';
        }
        if (name.length > 63) {
            return 'Name must be 63 characters or less';
        }
        return '';
    };

    const validateVolumeSize = (size: string): string => {
        if (!size) return 'Volume size is required';
        if (!/^\d+(\.\d+)?(B|KB|MB|GB|TB)$/i.test(size)) {
            return 'Size must be a number followed by unit (B, KB, MB, GB, TB). Example: 1GB, 500MB';
        }
        return '';
    };

    const handleVolumeNameChange = (name: string) => {
        setVolumeForm(prev => ({...prev, name}));
        setVolumeFormErrors(prev => ({...prev, name: validateVolumeName(name)}));
    };

    const handleVolumeSizeChange = (size: string) => {
        setVolumeForm(prev => ({...prev, size}));
        setVolumeFormErrors(prev => ({...prev, size: validateVolumeSize(size)}));
    };

    const handleCreateVolume = async () => {
        const nameError = validateVolumeName(volumeForm.name);
        const sizeError = validateVolumeSize(volumeForm.size);

        if (nameError || sizeError) {
            setVolumeFormErrors({
                name: nameError,
                size: sizeError
            });
            return;
        }

        setCreateVolumeModal(prev => ({...prev, creating: true}));

        try {
            await apiService.createVolume(volumeForm.name, volumeForm.size, volumeForm.type);
            setCreateVolumeModal({show: false, creating: false});
            setVolumeForm({name: '', size: '', type: 'filesystem'});
            setVolumeFormErrors({name: '', size: ''});
            await fetchVolumes();
        } catch (err) {
            setError(prev => ({
                ...prev,
                volumes: err instanceof Error ? err.message : 'Failed to create volume'
            }));
            setCreateVolumeModal(prev => ({...prev, creating: false}));
        }
    };

    const handleCreateNetwork = async () => {
        if (!networkForm.name || !networkForm.cidr) return;

        setCreateNetworkModal(prev => ({...prev, creating: true}));

        try {
            await apiService.createNetwork(networkForm.name, networkForm.cidr);
            setCreateNetworkModal({show: false, creating: false});
            setNetworkForm({name: '', cidr: ''});
            await fetchNetworks();
        } catch (err) {
            setError(prev => ({
                ...prev,
                networks: err instanceof Error ? err.message : 'Failed to create network'
            }));
            setCreateNetworkModal(prev => ({...prev, creating: false}));
        }
    };

    useEffect(() => {
        apiService.setNode(selectedNode);
        refreshAll();
    }, [selectedNode]);

    const formatSize = (size: string | number): string => {
        if (typeof size === 'string' && /\d+(\.\d+)?\s*(B|KB|MB|GB|TB)$/i.test(size)) {
            return size;
        }

        const numericSize = typeof size === 'string' ? parseInt(size) : size;

        if (numericSize === 0 || isNaN(numericSize)) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(numericSize) / Math.log(k));
        return parseFloat((numericSize / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-6">
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">{t('resources.title')}</h1>
                        <p className="mt-2 text-gray-300">{t('resources.subtitle')}</p>
                    </div>
                    <button
                        onClick={refreshAll}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <RefreshCw className="h-4 w-4 mr-2"/>
                        Refresh All
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Volumes */}
                <div className="bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <HardDrive className="h-6 w-6 text-blue-600 mr-3"/>
                                <h3 className="text-lg font-semibold text-gray-200">Volumes</h3>
                            </div>
                            <button
                                onClick={fetchVolumes}
                                className="text-gray-400 hover:text-gray-600"
                                title={t('resources.refreshVolumes')}
                            >
                                <RefreshCw className="h-4 w-4"/>
                            </button>
                        </div>

                        {loading.volumes ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500">{t('resources.loadingVolumes')}</p>
                            </div>
                        ) : error.volumes ? (
                            <div className="text-center py-8">
                                <p className="text-red-500 text-sm">{error.volumes}</p>
                            </div>
                        ) : volumes.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500 mb-4">No volumes configured</p>
                                <button
                                    onClick={() => setCreateVolumeModal({show: true, creating: false})}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                    <Plus className="h-4 w-4 mr-2"/>
                                    Create Volume
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {volumes.map((volume, index) => (
                                    <div key={volume.id || volume.name || index} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-300">{volume.name}</p>
                                                <p className="text-sm text-gray-500">{volume.type}</p>
                                                <p className="text-sm text-gray-500">{volume.mountPath || `/volumes/${volume.name}`}</p>
                                            </div>
                                            <div className="text-right mr-3">
                                                <p className="text-sm text-gray-600">{formatSize(volume.size)}</p>
                                                {volume.created_time && (
                                                    <p className="text-xs text-gray-400">{new Date(volume.created_time).toLocaleDateString()}</p>
                                                )}
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => handleDeleteVolume(volume.name)}
                                                    className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                                                    title={t('resources.deleteVolume')}
                                                >
                                                    <Trash2 className="h-4 w-4"/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setCreateVolumeModal({show: true, creating: false})}
                                    className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                    <Plus className="h-4 w-4 mr-2"/>
                                    Create Volume
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Networks */}
                <div className="bg-gray-800 rounded-lg shadow">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Network className="h-6 w-6 text-green-600 mr-3"/>
                                <h3 className="text-lg font-semibold text-gray-200">Networks</h3>
                            </div>
                            <button
                                onClick={fetchNetworks}
                                className="text-gray-400 hover:text-gray-600"
                                title={t('resources.refreshNetworks')}
                            >
                                <RefreshCw className="h-4 w-4"/>
                            </button>
                        </div>

                        {loading.networks ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500">{t('resources.loadingNetworks')}</p>
                            </div>
                        ) : error.networks ? (
                            <div className="text-center py-8">
                                <p className="text-red-500 text-sm">{error.networks}</p>
                            </div>
                        ) : networks.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500 mb-4">No networks configured</p>
                                <button
                                    onClick={() => setCreateNetworkModal({show: true, creating: false})}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                                    <Plus className="h-4 w-4 mr-2"/>
                                    Create Network
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {networks.map((network, index) => (
                                    <div key={network.id || network.name || index} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-300">{network.name}</p>
                                                <p className="text-sm text-gray-500">{network.type}</p>
                                            </div>
                                            <div className="text-right mr-3">
                                                <p className="text-sm text-gray-600">{network.subnet || network.cidr || 'N/A'}</p>
                                            </div>
                                            {(network.name !== 'bridge' && network.name !== 'host') && (
                                                <div>
                                                    <button
                                                        onClick={() => handleDeleteNetwork(network.name)}
                                                        className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                                                        title={t('resources.deleteNetwork')}
                                                    >
                                                        <Trash2 className="h-4 w-4"/>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setCreateNetworkModal({show: true, creating: false})}
                                    className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                                    <Plus className="h-4 w-4 mr-2"/>
                                    Create Network
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Volume Confirmation Dialog */}
            {deleteConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Delete Volume
                                </h3>
                                <button
                                    onClick={cancelDeleteVolume}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={deleteConfirm.deleting}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to delete the volume "{deleteConfirm.volumeName}"?
                                    </p>
                                    <p className="text-sm text-red-400">
                                        This action cannot be UNDONE. All data in this volume will be permanently lost.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-red-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx volume remove ${deleteConfirm.volumeName}`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelDeleteVolume}
                                    disabled={deleteConfirm.deleting}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteVolume}
                                    disabled={deleteConfirm.deleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {deleteConfirm.deleting ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2"/>
                                            Delete
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Volume Modal */}
            {createVolumeModal.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">Create Volume</h3>
                                <button
                                    onClick={() => {
                                        setCreateVolumeModal({show: false, creating: false});
                                        setVolumeFormErrors({name: '', size: ''});
                                    }}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={createVolumeModal.creating}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={volumeForm.name}
                                        onChange={(e) => handleVolumeNameChange(e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-md bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 ${
                                            volumeFormErrors.name
                                                ? 'border-red-500 focus:ring-red-500'
                                                : 'border-gray-600 focus:ring-blue-500'
                                        }`}
                                        placeholder="e.g., backend, cache, data"
                                        disabled={createVolumeModal.creating}
                                    />
                                    {volumeFormErrors.name && (
                                        <p className="mt-1 text-xs text-red-400">{volumeFormErrors.name}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Size
                                        </label>
                                        <input
                                            type="text"
                                            value={volumeForm.size}
                                            onChange={(e) => handleVolumeSizeChange(e.target.value)}
                                            className={`w-full px-3 py-2 border rounded-md bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 ${
                                                volumeFormErrors.size
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : 'border-gray-600 focus:ring-blue-500'
                                            }`}
                                            placeholder="e.g., 1GB, 500MB"
                                            disabled={createVolumeModal.creating}
                                        />
                                        {volumeFormErrors.size && (
                                            <p className="mt-1 text-xs text-red-400">{volumeFormErrors.size}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Type
                                        </label>
                                        <select
                                            value={volumeForm.type}
                                            onChange={(e) => setVolumeForm(prev => ({...prev, type: e.target.value}))}
                                            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={createVolumeModal.creating}
                                        >
                                            <option value="filesystem">Filesystem</option>
                                            <option value="memory">Memory (tmpfs)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-green-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{volumeForm.name && volumeForm.size
    ? `rnx volume create ${volumeForm.name} --size=${volumeForm.size}${volumeForm.type !== 'filesystem' ? ` --type=${volumeForm.type}` : ''}`
    : '# Enter volume name and size to see command preview'}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={() => {
                                        setCreateVolumeModal({show: false, creating: false});
                                        setVolumeFormErrors({name: '', size: ''});
                                    }}
                                    disabled={createVolumeModal.creating}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateVolume}
                                    disabled={createVolumeModal.creating || !volumeForm.name || !volumeForm.size || !!volumeFormErrors.name || !!volumeFormErrors.size}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {createVolumeModal.creating ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2"/>
                                            Create
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Network Confirmation Dialog */}
            {deleteNetworkConfirm.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">
                                    Delete Network
                                </h3>
                                <button
                                    onClick={cancelDeleteNetwork}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={deleteNetworkConfirm.deleting}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-gray-300 mb-2">
                                        Are you sure you want to delete the network "{deleteNetworkConfirm.networkName}"?
                                    </p>
                                    <p className="text-sm text-red-400">
                                        This action cannot be UNDONE. Any containers using this network must be stopped
                                        first.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-red-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{`rnx network remove ${deleteNetworkConfirm.networkName}`}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={cancelDeleteNetwork}
                                    disabled={deleteNetworkConfirm.deleting}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDeleteNetwork}
                                    disabled={deleteNetworkConfirm.deleting}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {deleteNetworkConfirm.deleting ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="h-4 w-4 mr-2"/>
                                            Delete
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Network Modal */}
            {createNetworkModal.show && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-200">Create Network</h3>
                                <button
                                    onClick={() => setCreateNetworkModal({show: false, creating: false})}
                                    className="text-gray-400 hover:text-gray-300"
                                    disabled={createNetworkModal.creating}
                                >
                                    <X className="h-5 w-5"/>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={networkForm.name}
                                        onChange={(e) => setNetworkForm(prev => ({...prev, name: e.target.value}))}
                                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="e.g., backend-net, app-network"
                                        disabled={createNetworkModal.creating}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        CIDR Range
                                    </label>
                                    <input
                                        type="text"
                                        value={networkForm.cidr}
                                        onChange={(e) => setNetworkForm(prev => ({...prev, cidr: e.target.value}))}
                                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="e.g., 10.1.0.0/24, 192.168.100.0/24"
                                        disabled={createNetworkModal.creating}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Format: IP address followed by subnet mask (e.g., 10.1.0.0/24)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Command Preview
                                    </label>
                                    <pre
                                        className="bg-gray-900 text-green-400 p-4 rounded-md text-sm overflow-x-auto font-mono">
{networkForm.name && networkForm.cidr
    ? `rnx network create ${networkForm.name} --cidr=${networkForm.cidr}`
    : '# Enter network name and CIDR range to see command preview'}
                                    </pre>
                                </div>
                            </div>

                            <div className="flex space-x-3 justify-end mt-6">
                                <button
                                    onClick={() => setCreateNetworkModal({show: false, creating: false})}
                                    disabled={createNetworkModal.creating}
                                    className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateNetwork}
                                    disabled={createNetworkModal.creating || !networkForm.name || !networkForm.cidr}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center"
                                >
                                    {createNetworkModal.creating ? (
                                        <>
                                            <div
                                                className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2"/>
                                            Create
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

export default Resources;