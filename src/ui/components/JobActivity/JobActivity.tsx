import {useRef, useEffect, useState, useMemo} from 'react';
import {Activity, Terminal, Globe, ArrowUpRight, ArrowDownLeft, Send, Download, Cpu, Shield, Filter} from 'lucide-react';
import {useTelemetryStream, TelemetryEvent, TelemetryEventType} from '../../hooks/useTelemetryStream';

interface JobActivityProps {
    jobId: string;
}

type FilterType = 'all' | 'EXEC' | 'NET' | 'ACCEPT' | 'SEND' | 'RECV' | 'MMAP' | 'MPROTECT';

export const JobActivity: React.FC<JobActivityProps> = ({jobId}) => {
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const containerRef = useRef<HTMLDivElement>(null);

    const MAX_EVENTS = 1000;
    const {events, connected, error, clearEvents, totalEventsReceived} = useTelemetryStream(
        jobId,
        ['EXEC', 'NET', 'ACCEPT', 'SEND', 'RECV', 'MMAP', 'MPROTECT'],
        MAX_EVENTS
    );

    const filteredEvents = useMemo(() => {
        if (filter === 'all') return events;
        return events.filter(e => e.type === filter);
    }, [events, filter]);

    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [filteredEvents, autoScroll]);

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts * 1000);
        const timeStr = date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        return `${timeStr}.${ms}`;
    };

    const formatDuration = (ns: number | undefined) => {
        if (!ns) return '-';
        if (ns < 1000) return `${ns}ns`;
        if (ns < 1000000) return `${(ns / 1000).toFixed(2)}us`;
        if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
        return `${(ns / 1000000000).toFixed(2)}s`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
    };

    const formatProtFlags = (prot: number): string => {
        const flags: string[] = [];
        if (prot & 1) flags.push('R');
        if (prot & 2) flags.push('W');
        if (prot & 4) flags.push('X');
        return flags.length > 0 ? flags.join('') : 'NONE';
    };

    const getEventIcon = (type: TelemetryEventType) => {
        switch (type) {
            case 'EXEC':
                return <Terminal className="w-4 h-4 text-green-500"/>;
            case 'NET':
                return <ArrowUpRight className="w-4 h-4 text-blue-500"/>;
            case 'ACCEPT':
                return <ArrowDownLeft className="w-4 h-4 text-purple-500"/>;
            case 'SEND':
                return <Send className="w-4 h-4 text-cyan-500"/>;
            case 'RECV':
                return <Download className="w-4 h-4 text-teal-500"/>;
            case 'MMAP':
                return <Cpu className="w-4 h-4 text-orange-500"/>;
            case 'MPROTECT':
                return <Shield className="w-4 h-4 text-red-500"/>;
            default:
                return <Activity className="w-4 h-4 text-gray-500"/>;
        }
    };

    const getEventColor = (type: TelemetryEventType) => {
        switch (type) {
            case 'EXEC':
                return 'border-l-green-500';
            case 'NET':
                return 'border-l-blue-500';
            case 'ACCEPT':
                return 'border-l-purple-500';
            case 'SEND':
                return 'border-l-cyan-500';
            case 'RECV':
                return 'border-l-teal-500';
            case 'MMAP':
                return 'border-l-orange-500';
            case 'MPROTECT':
                return 'border-l-red-500';
            default:
                return 'border-l-gray-500';
        }
    };

    const renderExecEvent = (event: TelemetryEvent) => {
        const exec = event.exec!;
        const exitStatus = exec.exit_code !== undefined
            ? exec.exit_code === 0
                ? <span className="text-green-500">exit: 0</span>
                : <span className="text-red-500">exit: {exec.exit_code}</span>
            : null;

        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2 flex-wrap">
                    <span className="font-mono text-sm text-green-400">{exec.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{exec.pid}</span>
                    {exec.ppid > 0 && <span className="text-gray-500 text-xs">PPID:{exec.ppid}</span>}
                    {exitStatus}
                    {exec.duration_ns && (
                        <span className="text-gray-500 text-xs">{formatDuration(exec.duration_ns)}</span>
                    )}
                </div>
                {exec.filename && (
                    <div className="font-mono text-xs text-gray-400 truncate" title={exec.filename}>
                        {exec.filename}
                    </div>
                )}
                {exec.args && exec.args.length > 0 && (
                    <div className="font-mono text-xs text-gray-500 truncate" title={exec.args.join(' ')}>
                        {exec.args.join(' ')}
                    </div>
                )}
            </div>
        );
    };

    const renderNetEvent = (event: TelemetryEvent) => {
        const net = event.net!;
        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-blue-400">{net.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{net.pid}</span>
                    <span className="text-xs px-1 rounded bg-blue-900 text-blue-300">outgoing</span>
                </div>
                <div className="font-mono text-xs text-gray-400">
                    {net.src_addr}:{net.src_port} &rarr; {net.dst_addr}:{net.dst_port}
                    <span className="text-gray-500 ml-2">({net.protocol})</span>
                </div>
            </div>
        );
    };

    const renderAcceptEvent = (event: TelemetryEvent) => {
        const accept = event.accept!;
        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-purple-400">{accept.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{accept.pid}</span>
                    <span className="text-xs px-1 rounded bg-purple-900 text-purple-300">incoming</span>
                </div>
                <div className="font-mono text-xs text-gray-400">
                    {accept.src_addr}:{accept.src_port} &larr; {accept.dst_addr}:{accept.dst_port}
                    <span className="text-gray-500 ml-2">({accept.protocol})</span>
                </div>
            </div>
        );
    };

    const renderSendEvent = (event: TelemetryEvent) => {
        const send = event.send!;
        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-cyan-400">{send.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{send.pid}</span>
                    <span className="text-xs px-1 rounded bg-cyan-900 text-cyan-300">
                        {formatBytes(send.bytes)}
                    </span>
                </div>
                {send.dst_addr && (
                    <div className="font-mono text-xs text-gray-400">
                        &rarr; {send.dst_addr}:{send.dst_port}
                    </div>
                )}
            </div>
        );
    };

    const renderRecvEvent = (event: TelemetryEvent) => {
        const recv = event.recv!;
        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-teal-400">{recv.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{recv.pid}</span>
                    <span className="text-xs px-1 rounded bg-teal-900 text-teal-300">
                        {formatBytes(recv.bytes)}
                    </span>
                </div>
                {recv.src_addr && (
                    <div className="font-mono text-xs text-gray-400">
                        &larr; {recv.src_addr}:{recv.src_port}
                    </div>
                )}
            </div>
        );
    };

    const renderMmapEvent = (event: TelemetryEvent) => {
        const mmap = event.mmap!;
        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-orange-400">{mmap.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{mmap.pid}</span>
                    <span className="text-xs px-1 rounded bg-orange-900 text-orange-300">
                        {formatBytes(mmap.length)}
                    </span>
                    <span className="text-xs px-1 rounded bg-gray-700 text-gray-300">
                        {formatProtFlags(mmap.prot)}
                    </span>
                </div>
                <div className="font-mono text-xs text-gray-400">
                    addr: {mmap.addr}
                    {mmap.filename && <span className="ml-2">{mmap.filename}</span>}
                </div>
            </div>
        );
    };

    const renderMprotectEvent = (event: TelemetryEvent) => {
        const mprot = event.mprotect!;
        return (
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-red-400">{mprot.comm}</span>
                    <span className="text-gray-500 text-xs">PID:{mprot.pid}</span>
                    <span className="text-xs px-1 rounded bg-gray-700 text-gray-300">
                        {mprot.old_prot !== undefined && `${formatProtFlags(mprot.old_prot)} → `}
                        {formatProtFlags(mprot.prot)}
                    </span>
                </div>
                <div className="font-mono text-xs text-gray-400">
                    addr: {mprot.addr} len: {formatBytes(mprot.length)}
                </div>
            </div>
        );
    };

    const renderEvent = (event: TelemetryEvent) => {
        switch (event.type) {
            case 'EXEC':
                return event.exec ? renderExecEvent(event) : null;
            case 'NET':
                return event.net ? renderNetEvent(event) : null;
            case 'ACCEPT':
                return event.accept ? renderAcceptEvent(event) : null;
            case 'SEND':
                return event.send ? renderSendEvent(event) : null;
            case 'RECV':
                return event.recv ? renderRecvEvent(event) : null;
            case 'MMAP':
                return event.mmap ? renderMmapEvent(event) : null;
            case 'MPROTECT':
                return event.mprotect ? renderMprotectEvent(event) : null;
            default:
                return <span className="text-gray-500">Unknown event type: {event.type}</span>;
        }
    };

    // Count events by type
    const eventCounts = useMemo(() => {
        return {
            EXEC: events.filter(e => e.type === 'EXEC').length,
            NET: events.filter(e => e.type === 'NET').length,
            ACCEPT: events.filter(e => e.type === 'ACCEPT').length,
            SEND: events.filter(e => e.type === 'SEND').length,
            RECV: events.filter(e => e.type === 'RECV').length,
            MMAP: events.filter(e => e.type === 'MMAP').length,
            MPROTECT: events.filter(e => e.type === 'MPROTECT').length,
        };
    }, [events]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {connected ? 'Live' : 'Disconnected'}
                        </span>
                    </div>
                    <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Auto-scroll</span>
                    </label>
                </div>
                <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-400"/>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="all">All Events</option>
                        <option value="EXEC">Process Exec</option>
                        <option value="NET">Outgoing Conn</option>
                        <option value="ACCEPT">Incoming Conn</option>
                        <option value="SEND">Data Sent</option>
                        <option value="RECV">Data Received</option>
                        <option value="MMAP">Memory Map</option>
                        <option value="MPROTECT">Mem Protect</option>
                    </select>
                    <button
                        onClick={clearEvents}
                        className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
                <div className="flex items-center flex-wrap gap-4">
                    <div className="flex items-center space-x-1" title="Process executions (execve syscall)">
                        <Terminal className="w-4 h-4 text-green-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.EXEC}</span>
                    </div>
                    <div className="flex items-center space-x-1" title="Outgoing connections (connect syscall)">
                        <ArrowUpRight className="w-4 h-4 text-blue-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.NET}</span>
                    </div>
                    <div className="flex items-center space-x-1" title="Incoming connections (accept syscall)">
                        <ArrowDownLeft className="w-4 h-4 text-purple-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.ACCEPT}</span>
                    </div>
                    <div className="flex items-center space-x-1" title="Data sent over sockets">
                        <Send className="w-4 h-4 text-cyan-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.SEND}</span>
                    </div>
                    <div className="flex items-center space-x-1" title="Data received over sockets">
                        <Download className="w-4 h-4 text-teal-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.RECV}</span>
                    </div>
                    <div className="flex items-center space-x-1" title="Memory mapping operations">
                        <Cpu className="w-4 h-4 text-orange-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.MMAP}</span>
                    </div>
                    <div className="flex items-center space-x-1" title="Memory protection changes">
                        <Shield className="w-4 h-4 text-red-500"/>
                        <span className="text-gray-600 dark:text-gray-400">{eventCounts.MPROTECT}</span>
                    </div>
                </div>
                <div className="text-xs text-gray-500" title={`Showing last ${MAX_EVENTS} events. Total received: ${totalEventsReceived}`}>
                    {totalEventsReceived > MAX_EVENTS ? (
                        <span className="text-yellow-500">
                            Showing {events.length}/{totalEventsReceived} (last {MAX_EVENTS})
                        </span>
                    ) : (
                        <span>{events.length} events</span>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 rounded">
                    Error: {error}
                </div>
            )}

            {/* Events List */}
            <div
                ref={containerRef}
                className="bg-gray-900 rounded-lg h-[45vh] overflow-y-auto"
            >
                {filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Activity className="w-10 h-10 mb-3 opacity-50"/>
                        <p>No telematics events yet...</p>
                        <p className="text-sm mt-1">
                            {connected
                                ? 'Waiting for eBPF telematics events from the job.'
                                : 'Connecting to telematics stream...'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800">
                        {filteredEvents.map((event, index) => (
                            <div
                                key={index}
                                className={`p-2 border-l-4 ${getEventColor(event.type)} hover:bg-gray-800 transition-colors`}
                            >
                                <div className="flex items-start space-x-2">
                                    <div className="flex-shrink-0 mt-1">
                                        {getEventIcon(event.type)}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-gray-500 font-mono">
                                                {formatTimestamp(event.timestamp)}
                                            </span>
                                            <span className="text-xs text-gray-600 uppercase font-mono">
                                                {event.type}
                                            </span>
                                        </div>
                                        {renderEvent(event)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info Footer */}
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                <p>
                    Activity monitoring powered by eBPF. Captures real-time syscall events: process executions (execve),
                    network connections (connect/accept), socket I/O (send/recv), and memory operations (mmap/mprotect).
                </p>
                <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        CLI Command Reference
                    </label>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-sm overflow-x-auto font-mono">
rnx job telematics {jobId}
                    </pre>
                    <p className="text-gray-500 mt-2 text-xs">
                        Stream telematics events for this job. Add <code className="text-yellow-400 bg-gray-900 px-1 rounded">--types=exec,net</code> to filter event types.
                    </p>
                </div>
            </div>
        </div>
    );
};