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
    const mountedRef = useRef<boolean>(true);
    const seenMessages = useRef<Set<string>>(new Set());
    const {selectedNode} = useNode();
    const {formatTime} = useDateFormatter();

    const clearLogs = useCallback(() => {
        setLogs([]);
        seenMessages.current.clear();
    }, []);

    useEffect(() => {
        if (!jobId) {
            setConnected(false);
            setLogs([]);
            seenMessages.current.clear();
            return;
        }

        // Reset mounted flag
        mountedRef.current = true;

        // To prevent duplicate logs from multiple connections (e.g., React StrictMode)
        // Close any existing connection first
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
            console.log('Closing existing WebSocket connection');
            wsRef.current.close();
        }

        const wsUrl = `ws://${window.location.host}/ws/logs/${jobId}?node=${encodeURIComponent(selectedNode)}`;
        console.log(`Opening WebSocket connection to: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log(`WebSocket connected for job: ${jobId}`);
            setConnected(true);
            setError(null);
        };

        ws.onmessage = (event: MessageEvent) => {
            // Only process messages if component is still mounted
            if (!mountedRef.current) {
                return;
            }

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

                // Create a unique key for deduplication (message + type)
                // Don't deduplicate connection/info messages as they're usually single-time events
                const shouldDeduplicate = type === 'output' || type === 'system';
                const messageKey = shouldDeduplicate ? `${message}:${type}` : `${Date.now()}:${Math.random()}`;

                // Skip if we've already seen this message
                if (seenMessages.current.has(messageKey)) {
                    console.log(`Skipping duplicate message: ${message.substring(0, 50)}...`);
                    return;
                }

                // Mark as seen
                seenMessages.current.add(messageKey);

                setLogs(prev => [...prev, {
                    message,
                    type,
                    timestamp
                }]);
            } catch {
                // Fallback for plain text logs
                const timestamp = formatTime(new Date());
                const message = event.data;
                const messageKey = `${message}:output`;

                // Skip duplicates
                if (seenMessages.current.has(messageKey)) {
                    console.log(`Skipping duplicate plain text message`);
                    return;
                }

                seenMessages.current.add(messageKey);

                setLogs(prev => [...prev, {
                    message,
                    type: 'output',
                    timestamp
                }]);
            }
        };

        ws.onerror = () => {
            console.error(`WebSocket error for job: ${jobId}`);
            setError('WebSocket connection error');
        };

        ws.onclose = () => {
            console.log(`WebSocket closed for job: ${jobId}`);
            setConnected(false);
        };

        return () => {
            console.log(`Cleaning up WebSocket for job: ${jobId}`);
            mountedRef.current = false;
            if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
                ws.close();
            }
            wsRef.current = null;
        };
    }, [jobId, selectedNode, formatTime]);

    return {logs, connected, error, clearLogs};
};