import {useCallback, useEffect, useState} from 'react';
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

interface UseVolumesReturn {
    volumes: Volume[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useVolumes = (): UseVolumesReturn => {
    const [volumes, setVolumes] = useState<Volume[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const {selectedNode} = useNode();

    // Sync apiService with selected node
    useEffect(() => {
        apiService.setNode(selectedNode);
    }, [selectedNode]);

    const fetchVolumes = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiService.getVolumes();
            setVolumes(response.volumes || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch volumes');
        } finally {
            setLoading(false);
        }
    }, [selectedNode]); // Re-fetch when node changes

    const refetch = useCallback(() => {
        fetchVolumes();
    }, [fetchVolumes]);

    // Volumes are node-specific, refetch when node changes

    useEffect(() => {
        fetchVolumes();
    }, [fetchVolumes]);

    return {volumes, loading, error, refetch};
};