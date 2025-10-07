import {useCallback, useEffect, useRef, useState} from 'react';
import {useNode} from '../contexts/NodeContext';
import {useDateFormatter} from './useDateFormatter';

interface LogEntry {
    message: string;
    type: 'system' | 'info' | 'output' | 'error' | 'connection';
    timestamp: string;
}

interface UseLogStreamReturn {
    logs: LogEntry[];
    connected: boolean;
    error: string | null;
    clearLogs: () => void;
}

export const useLogStream = (jobId: string | null): UseLogStreamReturn => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [connected, setConnected] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const {selectedNode} = useNode();
    const {formatTime} = useDateFormatter();

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    useEffect(() => {
        if (!jobId) {
            setConnected(false);
            setLogs([]);
            return;
        }

        const wsUrl = `ws://${window.location.host}/ws/logs/${jobId}?node=${encodeURIComponent(selectedNode)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            setError(null);
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                const logEntry = JSON.parse(event.data);
                const timestamp = formatTime(new Date());

                let type: 'system' | 'info' | 'output' | 'error' | 'connection' = 'output';
                let message = logEntry.message;

                if (logEntry.type === 'log') {
                    // Log messages use 'data' field
                    message = logEntry.data || logEntry.message;
                    if (logEntry.subtype === 'system') {
                        type = 'system';
                    } else if (logEntry.subtype === 'info') {
                        type = 'info';
                    } else {
                        type = 'output';
                    }
                } else if (logEntry.type === 'info') {
                    type = 'info';
                    message = logEntry.message;
                } else if (logEntry.type === 'error') {
                    type = 'error';
                    message = logEntry.message || 'Unknown error';
                } else if (logEntry.type === 'connection') {
                    type = 'connection';
                    message = logEntry.message;
                } else if (logEntry.type === 'end') {
                    type = 'info';
                    message = logEntry.message || 'Stream ended';
                } else if (logEntry.type === 'status') {
                    type = 'connection';
                    message = `STATUS: ${logEntry.message}`;
                } else {
                    // Fallback for unknown message types
                    message = logEntry.message || logEntry.data || JSON.stringify(logEntry);
                }

                setLogs(prev => [...prev, {
                    message,
                    type,
                    timestamp
                }]);
            } catch {
                // Fallback for plain text logs
                const timestamp = formatTime(new Date());
                setLogs(prev => [...prev, {
                    message: event.data,
                    type: 'output',
                    timestamp
                }]);
            }
        };

        ws.onerror = () => {
            setError('WebSocket connection error');
        };

        ws.onclose = () => {
            setConnected(false);
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [jobId, selectedNode]);

    return {logs, connected, error, clearLogs};
};