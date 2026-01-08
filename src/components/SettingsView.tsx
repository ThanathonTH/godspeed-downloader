import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Terminal,
    Trash2,
    Settings,
    Download,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Loader2,
    Wrench,
} from "lucide-react";

// Placeholder URL for engine update - replace with actual GitHub release URL
const ENGINE_UPDATE_URL = "https://github.com/YOUR_REPO/releases/download/v2.1.0/engine.zip";

// App version
const APP_VERSION = "2.1.0";

type UpdateStatus = "idle" | "loading" | "success" | "error";

interface SettingsViewProps {
    isTerminalEnabled: boolean;
    onToggleTerminalEnabled: (value: boolean) => void;
    autoClearUrl: boolean;
    onToggleAutoClear: (value: boolean) => void;
}

/**
 * Settings panel with industrial-style toggle switches.
 * Manages user preferences for terminal visibility and auto-clear behavior.
 */
function SettingsView({
    isTerminalEnabled,
    onToggleTerminalEnabled,
    autoClearUrl,
    onToggleAutoClear,
}: SettingsViewProps) {
    // Engine update state
    const [engineUpdateStatus, setEngineUpdateStatus] = useState<UpdateStatus>("idle");
    const [engineUpdateMessage, setEngineUpdateMessage] = useState("");

    /**
     * Handle engine update/repair
     */
    const handleEngineUpdate = async () => {
        setEngineUpdateStatus("loading");
        setEngineUpdateMessage("");

        try {
            const result = await invoke<string>("install_engine_update", {
                url: ENGINE_UPDATE_URL,
            });
            setEngineUpdateStatus("success");
            setEngineUpdateMessage(result);

            // Auto-reset success state after 5 seconds
            setTimeout(() => {
                setEngineUpdateStatus("idle");
                setEngineUpdateMessage("");
            }, 5000);
        } catch (error) {
            setEngineUpdateStatus("error");
            setEngineUpdateMessage(String(error));
        }
    };

    /**
     * Mock app update check (placeholder for tauri-plugin-updater)
     */
    const handleCheckAppUpdate = async () => {
        // TODO: Integrate with tauri-plugin-updater
        console.log("Checking for app updates...");
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Settings className="w-8 h-8 text-[#00ff88]" />
                    <h1 className="text-3xl font-bold text-white">
                        SETTINGS
                    </h1>
                </div>
                <p className="text-white/40 text-sm tracking-wide uppercase">
                    System Configuration
                </p>
            </header>

            {/* Settings Panel */}
            <div className="glass-panel p-6 max-w-2xl space-y-6">
                {/* Interface Section */}
                <div className="space-y-1">
                    <h2 className="text-xs font-medium text-white/50 tracking-wider uppercase mb-4">
                        Interface
                    </h2>

                    <ToggleItem
                        icon={<Terminal className="w-5 h-5" />}
                        title="Enable Terminal"
                        description="Show the terminal toggle button in the sidebar and allow viewing system output"
                        checked={isTerminalEnabled}
                        onChange={onToggleTerminalEnabled}
                    />

                    <div className="border-t border-white/5 my-4" />

                    <h2 className="text-xs font-medium text-white/50 tracking-wider uppercase mb-4 pt-2">
                        Behavior
                    </h2>

                    <ToggleItem
                        icon={<Trash2 className="w-5 h-5" />}
                        title="Auto-Clear URL"
                        description="Automatically clear the URL input after a successful download"
                        checked={autoClearUrl}
                        onChange={onToggleAutoClear}
                    />
                </div>

                {/* Divider */}
                <div className="border-t border-white/10 my-6" />

                {/* Updates & Maintenance Section */}
                <div className="space-y-4">
                    <h2 className="text-xs font-medium text-white/50 tracking-wider uppercase mb-4">
                        Updates & Maintenance
                    </h2>

                    {/* Version Badge */}
                    <div className="flex items-center gap-3 py-3 px-4 -mx-4 rounded-lg bg-white/2">
                        <div className="flex items-center gap-2 text-white/60">
                            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                            <span className="text-sm font-medium">Current Version:</span>
                        </div>
                        <span className="text-[#00ff88] font-mono font-bold tracking-wide">
                            v{APP_VERSION}
                        </span>
                    </div>

                    {/* App Update Button */}
                    <ActionButton
                        icon={<Download className="w-5 h-5" />}
                        title="Check for App Updates"
                        description="Download and install the latest version of Godspeed"
                        onClick={handleCheckAppUpdate}
                        status="idle"
                    />

                    {/* Engine Repair Button */}
                    <ActionButton
                        icon={<Wrench className="w-5 h-5" />}
                        title="Reinstall / Update Engine V12"
                        description="Download fresh copies of yt-dlp, aria2c, and ffmpeg binaries"
                        onClick={handleEngineUpdate}
                        status={engineUpdateStatus}
                        statusMessage={engineUpdateMessage}
                    />
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-auto pt-8">
                <p className="text-white/20 text-xs">
                    GODSPEED DOWNLOADER v{APP_VERSION}
                </p>
            </footer>
        </div>
    );
}

interface ToggleItemProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}

function ToggleItem({ icon, title, description, checked, onChange }: ToggleItemProps) {
    return (
        <div className="flex items-center justify-between py-4 px-4 -mx-4 rounded-lg hover:bg-white/2 transition-colors">
            {/* Left: Icon + Text */}
            <div className="flex items-start gap-4">
                <div className={`mt-0.5 ${checked ? "text-[#00ff88]" : "text-white/40"} transition-colors`}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-white font-medium">{title}</h3>
                    <p className="text-white/40 text-sm mt-0.5">{description}</p>
                </div>
            </div>

            {/* Right: Toggle Switch */}
            <button
                onClick={() => onChange(!checked)}
                className={`relative w-12 h-7 rounded-full transition-all duration-200 shrink-0 ${checked
                    ? "bg-[#00ff88]/20 shadow-[0_0_15px_rgba(0,255,136,0.3)]"
                    : "bg-white/10"
                    }`}
            >
                <div
                    className={`absolute top-1 w-5 h-5 rounded-full transition-all duration-200 ${checked
                        ? "left-6 bg-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.5)]"
                        : "left-1 bg-white/40"
                        }`}
                />
            </button>
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    status: UpdateStatus;
    statusMessage?: string;
}

function ActionButton({
    icon,
    title,
    description,
    onClick,
    status,
    statusMessage,
}: ActionButtonProps) {
    const isLoading = status === "loading";
    const isSuccess = status === "success";
    const isError = status === "error";

    return (
        <div className="py-4 px-4 -mx-4 rounded-lg hover:bg-white/2 transition-colors">
            <div className="flex items-center justify-between">
                {/* Left: Icon + Text */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`mt-0.5 ${isSuccess ? "text-[#00ff88]" : isError ? "text-red-400" : "text-white/40"} transition-colors`}>
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isSuccess ? (
                            <CheckCircle className="w-5 h-5" />
                        ) : isError ? (
                            <AlertTriangle className="w-5 h-5" />
                        ) : (
                            icon
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-white font-medium">{title}</h3>
                        <p className="text-white/40 text-sm mt-0.5">
                            {isLoading
                                ? "Downloading Engine..."
                                : isSuccess
                                    ? statusMessage || "Update complete!"
                                    : isError
                                        ? statusMessage || "Update failed"
                                        : description}
                        </p>
                    </div>
                </div>

                {/* Right: Action Button */}
                <button
                    onClick={onClick}
                    disabled={isLoading}
                    className={`shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${isLoading
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : isSuccess
                            ? "bg-[#00ff88]/20 text-[#00ff88] hover:bg-[#00ff88]/30"
                            : isError
                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                        </>
                    ) : isSuccess ? (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Updated
                        </>
                    ) : isError ? (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Update
                        </>
                    )}
                </button>
            </div>

            {/* Error Details */}
            {isError && statusMessage && (
                <div className="mt-3 ml-9 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-xs font-mono wrap-break-word">
                        {statusMessage}
                    </p>
                </div>
            )}
        </div>
    );
}

export default SettingsView;
