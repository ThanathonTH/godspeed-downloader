import { useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";

interface TerminalDrawerProps {
    logs: string[];
    isVisible: boolean;
    onClose: () => void;
}

/**
 * Collapsible terminal drawer with matrix-style output and CRT scanline effect.
 * Auto-scrolls to bottom on new logs.
 */
function TerminalDrawer({ logs, isVisible, onClose }: TerminalDrawerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (scrollRef.current && isVisible) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isVisible]);

    return (
        <div
            className={`relative border-t border-white/10 bg-black/90 backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden ${isVisible ? "h-52" : "h-0"
                }`}
        >
            {/* CRT Scanline Overlay */}
            <div className="scanline-overlay" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/60 relative z-20">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500/80" />
                        <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
                        <div className="w-2 h-2 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-[10px] font-mono text-white/50 ml-2 tracking-widest">
                        SYSTEM OUTPUT
                    </span>
                    {/* Live indicator */}
                    <div className="flex items-center gap-1 ml-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                        <span className="text-[9px] font-mono text-[#00ff88]/60">LIVE</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onClose}
                        className="p-1 text-white/40 hover:text-white/80 transition-colors btn-tactile"
                        title="Minimize"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 text-white/40 hover:text-red-400 transition-colors btn-tactile"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Log Output */}
            <div
                ref={scrollRef}
                className="h-[calc(100%-36px)] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed relative z-10"
            >
                {logs.length === 0 ? (
                    <div className="text-white/30 italic flex items-center gap-2">
                        <span className="inline-block w-2 h-4 bg-[#00ff88]/50 animate-pulse" />
                        Awaiting input...
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <LogLine key={index} text={log} index={index} />
                    ))
                )}
            </div>
        </div>
    );
}

interface LogLineProps {
    text: string;
    index: number;
}

function LogLine({ text, index }: LogLineProps) {
    // Colorize based on content
    let colorClass = "text-[#00ff88]/70";
    let prefix = "";

    if (text.includes("[ERROR]") || text.includes("error") || text.includes("Error")) {
        colorClass = "text-red-400";
        prefix = "ERR";
    } else if (text.includes("[WARNING]") || text.includes("warning")) {
        colorClass = "text-yellow-400";
        prefix = "WRN";
    } else if (text.includes("GODSPEED")) {
        colorClass = "text-cyan-400";
        prefix = "SYS";
    } else if (text.includes("completed") || text.includes("finished")) {
        colorClass = "text-[#00ff88]";
        prefix = "OK ";
    } else if (text.includes("%")) {
        colorClass = "text-[#00ff88]/80";
        prefix = "DL ";
    } else {
        prefix = "LOG";
    }

    return (
        <div className={`${colorClass} whitespace-pre-wrap break-all flex gap-2`}>
            <span className="text-white/20 select-none shrink-0">
                {String(index + 1).padStart(3, "0")}
            </span>
            <span className="text-white/30 select-none shrink-0">[{prefix}]</span>
            <span>{text}</span>
        </div>
    );
}

export default TerminalDrawer;
