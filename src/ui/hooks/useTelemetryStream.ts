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

// Default maximum events to keep in memory (LRU eviction)
const DEFAULT_MAX_EVENTS = 1000;

interface UseTelemetryStreamResult {
    events: TelemetryEvent[];
    connected: boolean;
    error: string | null;
    clearEvents: () => void;
    totalEventsReceived: number;
}

export const useTelemetryStream = (
    jobId: string | null,
    types: string[] = ['EXEC', 'NET', 'ACCEPT', 'SEND', 'RECV', 'MMAP', 'MPROTECT'],
    maxEvents: number = DEFAULT_MAX_EVENTS
): UseTelemetryStreamResult => {
    const [events, setEvents] = useState<TelemetryEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalEventsReceived, setTotalEventsReceived] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const {selectedNode} = useNode();

    const clearEvents = useCallback(() => {
        setEvents([]);
        setTotalEventsReceived(0);
    }, []);

    // Memoize types to prevent unnecessary WebSocket reconnections
    const typesKey = useMemo(() => types.sort().join(','), [types.join(',')]);

    useEffect(() => {
        if (!jobId) {
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = (import.meta as any).env?.VITE_WS_HOST || window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws/telematics/${jobId}?node=${selectedNode}&types=${typesKey}`;

        console.log('Connecting to telematics WebSocket:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('Telematics WebSocket connected');
            setConnected(true);
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'telematics' && message.data) {
                    const telemetryEvent = message.data as TelemetryEvent;
                    // Only add non-metrics events (eBPF events)
                    if (telemetryEvent.type !== 'metrics') {
                        setTotalEventsReceived(prev => prev + 1);
                        setEvents(prev => {
                            const newEvents = [...prev, telemetryEvent];
                            // LRU eviction: keep only the last maxEvents
                            if (newEvents.length > maxEvents) {
                                return newEvents.slice(-maxEvents);
                            }
                            return newEvents;
                        });
                    }
                } else if (message.type === 'error') {
                    console.error('Telematics stream error:', message.message);
                    setError(message.message);
                } else if (message.type === 'end') {
                    console.log('Telematics stream ended:', message.message);
                } else if (message.type === 'connection') {
                    console.log('Telematics connection message:', message.message);
                }
            } catch (e) {
                console.error('Failed to parse telematics message:', e);
            }
        };

        ws.onerror = (event) => {
            console.error('Telematics WebSocket error:', event);
            setError('WebSocket connection error');
        };

        ws.onclose = (event) => {
            console.log('Telematics WebSocket closed:', event.code, event.reason);
            setConnected(false);
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [jobId, selectedNode, typesKey, maxEvents]);

    return {events, connected, error, clearEvents, totalEventsReceived};
};