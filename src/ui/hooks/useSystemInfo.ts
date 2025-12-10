import {useCallback, useEffect, useState} from 'react';
import {DetailedSystemInfo} from '../types/monitor';
import {apiService} from '../services/apiService';
import {useNode} from '../contexts/NodeContext';

interface UseSystemInfoReturn {
    systemInfo: DetailedSystemInfo | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useSystemInfo = (): UseSystemInfoReturn => {
    const [systemInfo, setSystemInfo] = useState<DetailedSystemInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const {selectedNode} = useNode();

    // Sync apiService with selected node
    useEffect(() => {
        apiService.setNode(selectedNode);
    }, [selectedNode]);

    const fetchSystemInfo = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            setError(null);
            const response = await apiService.getDetailedSystemInfo();
            setSystemInfo(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch system information');
        } finally {
            setLoading(false);
        }
    }, [selectedNode]); // Re-fetch when node changes

    const refetch = useCallback(() => {
        fetchSystemInfo();
    }, [fetchSystemInfo]);

    // System info is node-specific, refetch when node changes

    useEffect(() => {
        fetchSystemInfo();
    }, [fetchSystemInfo]);

    return {systemInfo, loading, error, refetch};
};