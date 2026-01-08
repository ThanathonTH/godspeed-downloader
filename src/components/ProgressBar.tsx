interface ProgressBarProps {
    progress: number;
    isDownloading: boolean;
    isComplete?: boolean;
}

/**
 * Sleek progress bar with smart visibility.
 * Hidden when idle, slides in when active, glows at leading edge.
 */
function ProgressBar({ progress, isDownloading, isComplete = false }: ProgressBarProps) {
    const isPreparing = isDownloading && progress === 0;
    const displayProgress = Math.min(progress, 100);

    // Smart visibility: hide when not downloading and not complete
    const isVisible = isDownloading || isComplete;

    return (
        <div
            className={`flex flex-col gap-2 transition-all duration-300 ease-out overflow-hidden ${isVisible
                ? "opacity-100 max-h-20"
                : "opacity-0 max-h-0"
                }`}
        >
            {/* Status Row */}
            <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase tracking-wider font-medium">
                    Progress
                </span>
                <span className={`font-mono font-bold ${isComplete
                    ? "text-[#00ff88]"
                    : isPreparing
                        ? "text-cyan-400 animate-pulse"
                        : "text-[#00ff88]"
                    }`}>
                    {isComplete
                        ? "Complete"
                        : isPreparing
                            ? "Preparing..."
                            : `${displayProgress.toFixed(1)}%`
                    }
                </span>
            </div>

            {/* Progress Track */}
            <div className="relative h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                {/* Preparing Animation */}
                {isPreparing && (
                    <div className="absolute inset-0 overflow-hidden">
                        <div
                            className="h-full w-1/3 bg-linear-to-r from-transparent via-cyan-500/50 to-transparent"
                            style={{
                                animation: "shimmer 1.5s ease-in-out infinite",
                            }}
                        />
                    </div>
                )}

                {/* Progress Fill */}
                <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
                    style={{
                        width: `${displayProgress}%`,
                        background: isComplete
                            ? "linear-gradient(90deg, #00ff88, #00ff88)"
                            : "linear-gradient(90deg, #00ff88, #06b6d4)",
                        boxShadow: displayProgress > 0
                            ? "0 0 20px rgba(0, 255, 136, 0.5), 0 0 40px rgba(0, 255, 136, 0.2)"
                            : "none",
                    }}
                >
                    {/* Leading Edge Glow */}
                    {displayProgress > 0 && displayProgress < 100 && (
                        <div
                            className="absolute right-0 top-0 bottom-0 w-4 rounded-full"
                            style={{
                                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6))",
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProgressBar;
