import { RefObject } from "react";

interface TerminalProps {
    logs: string[];
    terminalRef: RefObject<HTMLDivElement | null>;
}

/**
 * Reusable terminal output component with color-coded log entries.
 * Displays download progress and status messages with a hacker/neon theme.
 */
function Terminal({ logs, terminalRef }: TerminalProps) {
    /**
     * Get the appropriate color class based on log content.
     */
    const getLogColor = (log: string): string => {
        if (log.includes("[ERROR]")) return "text-red-400";
        if (log.includes("[GODSPEED]")) return "text-neon-purple";
        return "text-[#00ff88]";
    };

    return (
        <div className="mt-6">
            {/* Terminal Header */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="text-xs text-white/50 tracking-wider">
                    TERMINAL OUTPUT
                </span>
            </div>

            {/* Terminal Body */}
            <div
                ref={terminalRef}
                className="h-40 bg-black/80 rounded-xl border border-white/5 p-4 overflow-y-auto font-mono text-xs"
            >
                {logs.length === 0 ? (
                    <div className="text-white/30 italic">
                        Waiting for download to start...
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`mb-1 ${getLogColor(log)}`}>
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Terminal;
