import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNode} from '../contexts/NodeContext';

// eBPF Event Types based on Joblet implementation
export type TelemetryEventType = 'EXEC' | 'NET' | 'ACCEPT' | 'SEND' | 'RECV' | 'MMAP' | 'MPROTECT' | 'metrics';

export interface TelemetryEvent {
    jobId: string;
    timestamp: number;
    type: TelemetryEventType;
    // Process execution event (EXEC - execve syscall)
    exec?: {
        pid: number;
        ppid: number;
        comm: string;
        filename: string;
        args: string[];
        uid: number;
        gid: number;
        exit_code?: number;
        duration_ns?: number;
    };
    // Network connection event (NET - outgoing connect syscall)
    net?: {
        pid: number;
        comm: string;
        src_addr: string;
        src_port: number;
        dst_addr: string;
        dst_port: number;
        protocol: string;
    };
    // Incoming connection event (ACCEPT - accept syscall)
    accept?: {
        pid: number;
        comm: string;
        src_addr: string;
        src_port: number;
        dst_addr: string;
        dst_port: number;
        protocol: string;
    };
    // Data sent event (SEND - socket send)
    send?: {
        pid: number;
        comm: string;
        fd: number;
        bytes: number;
        dst_addr?: string;
        dst_port?: number;
    };
    // Data received event (RECV - socket recv)
    recv?: {
        pid: number;
        comm: string;
        fd: number;
        bytes: number;
        src_addr?: string;
        src_port?: number;
    };
    // Memory mapping event (MMAP)
    mmap?: {
        pid: number;
        comm: string;
        addr: string;
        length: number;
        prot: number;
        flags: number;
        fd: number;
        filename?: string;
    };
    // Memory protection change event (MPROTECT)
    mprotect?: {
        pid: number;
        comm: string;
        addr: string;
        length: number;
        prot: number;
        old_prot?: number;
    };
    // Metrics data (for backwards compatibility)
    cpu?: {
        usage: number;
        usagePercent: number;
    };
    memory?: {
        current: number;
        limit: number;
    };
    io?: {
        readBytes: number;
        writeBytes: number;
    };
    network?: {
        rxBytes: number;
        txBytes: number;
    };
    gpu?: {
        percent: number;
        memoryBytes: number;
    };
}

interface UseTelemetryStreamResult {
    events: TelemetryEvent[];
    connected: boolean;
    error: string | null;
    clearEvents: () => void;
}

export const useTelemetryStream = (
    jobId: string | null,
    types: string[] = ['EXEC', 'NET', 'ACCEPT', 'SEND', 'RECV', 'MMAP', 'MPROTECT']
): UseTelemetryStreamResult => {
    const [events, setEvents] = useState<TelemetryEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const {selectedNode} = useNode();

    const clearEvents = useCallback(() => {
        setEvents([]);
    }, []);

    // Memoize types to prevent unnecessary WebSocket reconnections
    const typesKey = useMemo(() => types.sort().join(','), [types.join(',')]);

    useEffect(() => {
        if (!jobId) {
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = (import.meta as any).env?.VITE_WS_HOST || window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws/telemetry/${jobId}?node=${selectedNode}&types=${typesKey}`;

        console.log('Connecting to telemetry WebSocket:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('Telemetry WebSocket connected');
            setConnected(true);
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'telemetry' && message.data) {
                    const telemetryEvent = message.data as TelemetryEvent;
                    // Only add non-metrics events (eBPF events)
                    if (telemetryEvent.type !== 'metrics') {
                        setEvents(prev => [...prev, telemetryEvent]);
                    }
                } else if (message.type === 'error') {
                    console.error('Telemetry stream error:', message.message);
                    setError(message.message);
                } else if (message.type === 'end') {
                    console.log('Telemetry stream ended:', message.message);
                } else if (message.type === 'connection') {
                    console.log('Telemetry connection message:', message.message);
                }
            } catch (e) {
                console.error('Failed to parse telemetry message:', e);
            }
        };

        ws.onerror = (event) => {
            console.error('Telemetry WebSocket error:', event);
            setError('WebSocket connection error');
        };

        ws.onclose = (event) => {
            console.log('Telemetry WebSocket closed:', event.code, event.reason);
            setConnected(false);
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [jobId, selectedNode, typesKey]);

    return {events, connected, error, clearEvents};
};