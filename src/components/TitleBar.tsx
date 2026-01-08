import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Windows 11 style title bar with functional window controls.
 * Uses Tauri's window API for minimize, maximize/restore, and close.
 */
function TitleBar() {
    const appWindow = getCurrentWindow();

    const handleMinimize = () => {
        appWindow.minimize();
    };

    const handleMaximize = () => {
        appWindow.toggleMaximize();
    };

    const handleClose = () => {
        appWindow.close();
    };

    return (
        <div className="h-[32px] bg-black/60 backdrop-blur-md flex items-center justify-between border-b border-white/5 shrink-0 select-none">
            {/* Draggable Title Area - fills available space */}
            <div
                data-tauri-drag-region
                className="flex-1 h-full flex items-center gap-2 px-4 cursor-default"
            >
                <span className="text-[#00ff88] text-sm pointer-events-none">⚡</span>
                <span className="text-xs text-white/60 font-medium tracking-wider pointer-events-none">
                    GODSPEED DOWNLOADER
                </span>
            </div>

            {/* Windows Controls - z-50 to ensure above drag region */}
            <div className="flex items-center h-full relative z-50">
                {/* Minimize Button */}
                <button
                    onClick={handleMinimize}
                    className="w-11 h-8 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                    aria-label="Minimize"
                >
                    <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
                        <rect width="10" height="1" />
                    </svg>
                </button>

                {/* Maximize/Restore Button */}
                <button
                    onClick={handleMaximize}
                    className="w-11 h-8 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                    aria-label="Maximize"
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                        <rect x="0.5" y="0.5" width="9" height="9" />
                    </svg>
                </button>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="w-11 h-8 flex items-center justify-center text-white/60 hover:bg-red-500 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <line x1="0" y1="0" x2="10" y2="10" />
                        <line x1="10" y1="0" x2="0" y2="10" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default TitleBar;
