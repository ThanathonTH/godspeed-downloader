import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
    Terminal,
    Trash2,
    Settings,
    CheckCircle,
    AlertTriangle,
    Loader2,
    Wrench,
    Download,
    Sparkles,
    RefreshCw,
    Shield,
} from "lucide-react";

// App version - must match the version in tauri.conf.json
const APP_VERSION = "2.1.1";

// Placeholder URL for engine update - replace with actual GitHub release asset URL
const ENGINE_UPDATE_URL = "https://github.com/ThanathonTH/godspeed-downloader/releases/download/v2.1.0/engine_v12.zip";

// Types
type UpdateStatus = "idle" | "loading" | "success" | "error";
type AppUpdateStatus = "idle" | "checking" | "up-to-date" | "update-available" | "error";
type InstallStatus = "idle" | "downloading" | "installing" | "error";

interface UpdateInfo {
    update_available: boolean;
    latest_version: string;
    download_url: string;
}

interface SettingsViewProps {
    isTerminalEnabled: boolean;
    onToggleTerminalEnabled: (value: boolean) => void;
    autoClearUrl: boolean;
    onToggleAutoClear: (value: boolean) => void;
}

/**
 * Format error messages to be user-friendly
 */
function formatErrorMessage(error: string): string {
    const errorLower = error.toLowerCase();

    // Network/connection errors
    if (errorLower.includes("404") || errorLower.includes("not found")) {
        return "Update file not found. Please check if a new release is available.";
    }
    if (errorLower.includes("network") || errorLower.includes("connection") || errorLower.includes("failed to download")) {
        return "Unable to connect to update server. Please check your internet connection.";
    }
    if (errorLower.includes("timeout")) {
        return "Connection timed out. Please try again.";
    }

    // Permission errors
    if (errorLower.includes("permission") || errorLower.includes("access denied")) {
        return "Permission denied. Try running the app as administrator.";
    }
    if (errorLower.includes("in use") || errorLower.includes("locked") || errorLower.includes("busy")) {
        return "Files are in use. Please stop any active downloads and try again.";
    }

    // ZIP/extraction errors
    if (errorLower.includes("zip") || errorLower.includes("extract") || errorLower.includes("invalid")) {
        return "Downloaded file is corrupted. Please try again.";
    }

    // Keep short errors as-is, truncate long ones
    if (error.length > 100) {
        return error.substring(0, 97) + "...";
    }

    return error;
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
    // App update state
    const [appUpdateStatus, setAppUpdateStatus] = useState<AppUpdateStatus>("idle");
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [updateError, setUpdateError] = useState("");
    const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
    const [installError, setInstallError] = useState("");

    // Engine update state
    const [engineUpdateStatus, setEngineUpdateStatus] = useState<UpdateStatus>("idle");
    const [engineUpdateMessage, setEngineUpdateMessage] = useState("");

    /**
     * Check for app updates on mount
     */
    useEffect(() => {
        checkForUpdates();
    }, []);

    /**
     * Check for app updates via GitHub Releases API
     */
    const checkForUpdates = async () => {
        setAppUpdateStatus("checking");
        setUpdateError("");
        setUpdateInfo(null);

        try {
            const result = await invoke<UpdateInfo>("check_app_update", {
                currentVersion: APP_VERSION,
            });

            setUpdateInfo(result);

            if (result.update_available) {
                setAppUpdateStatus("update-available");
            } else {
                setAppUpdateStatus("up-to-date");
            }
        } catch (error) {
            setAppUpdateStatus("error");
            setUpdateError(formatErrorMessage(String(error)));
        }
    };

    /**
     * Download and install app update
     */
    const handleInstallUpdate = async () => {
        if (!updateInfo?.download_url) {
            setInstallError("No download URL available.");
            setInstallStatus("error");
            return;
        }

        setInstallStatus("downloading");
        setInstallError("");

        try {
            await invoke("install_app_update", {
                url: updateInfo.download_url,
            });
            // If we get here, the app should be closing
            setInstallStatus("installing");
        } catch (error) {
            setInstallStatus("error");
            setInstallError(formatErrorMessage(String(error)));
        }
    };

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
            setEngineUpdateMessage(formatErrorMessage(String(error)));
        }
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
                {/* App Update Section - Premium Design */}
                <div className="space-y-4">
                    <h2 className="text-xs font-medium text-white/50 tracking-wider uppercase mb-4 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        App Updates
                    </h2>

                    <AppUpdateCard
                        status={appUpdateStatus}
                        updateInfo={updateInfo}
                        updateError={updateError}
                        installStatus={installStatus}
                        installError={installError}
                        onRetryCheck={checkForUpdates}
                        onInstall={handleInstallUpdate}
                    />
                </div>

                {/* Divider */}
                <div className="border-t border-white/10 my-6" />

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

                {/* Engine Maintenance Section */}
                <div className="space-y-4">
                    <h2 className="text-xs font-medium text-white/50 tracking-wider uppercase mb-4">
                        Engine Maintenance
                    </h2>

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

// ============================================================================
// APP UPDATE CARD - World-Class UI Component
// ============================================================================

interface AppUpdateCardProps {
    status: AppUpdateStatus;
    updateInfo: UpdateInfo | null;
    updateError: string;
    installStatus: InstallStatus;
    installError: string;
    onRetryCheck: () => void;
    onInstall: () => void;
}

function AppUpdateCard({
    status,
    updateInfo,
    updateError,
    installStatus,
    installError,
    onRetryCheck,
    onInstall,
}: AppUpdateCardProps) {
    // Determine current display state
    const isChecking = status === "checking";
    const isUpToDate = status === "up-to-date";
    const hasUpdate = status === "update-available";
    const hasCheckError = status === "error";
    const isDownloading = installStatus === "downloading";
    const isInstalling = installStatus === "installing";
    const hasInstallError = installStatus === "error";

    // Card styling based on state
    const getCardStyle = () => {
        if (hasUpdate) return "bg-linear-to-r from-[#00ff88]/10 to-[#00ff88]/5 border-[#00ff88]/30";
        if (isUpToDate) return "bg-white/2 border-white/10";
        if (hasCheckError || hasInstallError) return "bg-amber-500/10 border-amber-500/30";
        return "bg-white/2 border-white/10";
    };

    return (
        <div className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-500 ${getCardStyle()}`}>
            {/* Background glow effect for update available */}
            {hasUpdate && (
                <div className="absolute inset-0 bg-linear-to-r from-[#00ff88]/5 to-transparent animate-pulse" />
            )}

            <div className="relative flex items-center justify-between gap-4">
                {/* Left: Status Icon + Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Status Icon */}
                    <div className={`mt-0.5 shrink-0 ${isChecking || isDownloading || isInstalling ? "text-white/60" :
                        isUpToDate ? "text-[#00ff88]" :
                            hasUpdate ? "text-[#00ff88]" :
                                "text-amber-400"
                        }`}>
                        {isChecking && <Loader2 className="w-6 h-6 animate-spin" />}
                        {isDownloading && <Download className="w-6 h-6 animate-bounce" />}
                        {isInstalling && <Loader2 className="w-6 h-6 animate-spin" />}
                        {isUpToDate && <CheckCircle className="w-6 h-6" />}
                        {hasUpdate && <Sparkles className="w-6 h-6 animate-pulse" />}
                        {(hasCheckError || hasInstallError) && <AlertTriangle className="w-6 h-6" />}
                        {status === "idle" && !isDownloading && !isInstalling && !hasInstallError && (
                            <RefreshCw className="w-6 h-6" />
                        )}
                    </div>

                    {/* Text Content */}
                    <div className="min-w-0 flex-1">
                        {/* Title */}
                        <h3 className="text-white font-semibold text-lg">
                            {isChecking && "Checking for Updates..."}
                            {isDownloading && "Downloading Update..."}
                            {isInstalling && "Installing Update..."}
                            {isUpToDate && "You're Up to Date!"}
                            {hasUpdate && `Version ${updateInfo?.latest_version} Available!`}
                            {hasCheckError && "Update Check Failed"}
                            {hasInstallError && "Installation Failed"}
                            {status === "idle" && !isDownloading && !isInstalling && !hasInstallError && "Check for Updates"}
                        </h3>

                        {/* Description */}
                        <p className={`text-sm mt-1 ${hasCheckError || hasInstallError ? "text-amber-400/80" : "text-white/50"
                            }`}>
                            {isChecking && "Connecting to GitHub..."}
                            {isDownloading && "Please wait while the installer downloads..."}
                            {isInstalling && "The installer will start shortly. This app will close."}
                            {isUpToDate && (
                                <>Running version <span className="font-mono text-[#00ff88]">v{APP_VERSION}</span> — the latest release</>
                            )}
                            {hasUpdate && (
                                <>Current: <span className="font-mono">v{APP_VERSION}</span> → New: <span className="font-mono text-[#00ff88]">v{updateInfo?.latest_version}</span></>
                            )}
                            {hasCheckError && updateError}
                            {hasInstallError && installError}
                            {status === "idle" && !isDownloading && !isInstalling && !hasInstallError && (
                                "Click to check for new versions"
                            )}
                        </p>
                    </div>
                </div>

                {/* Right: Action Button */}
                <div className="shrink-0">
                    {/* Checking - No button */}
                    {isChecking && (
                        <div className="w-28" /> // Spacer
                    )}

                    {/* Up to Date - Disabled badge */}
                    {isUpToDate && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00ff88]/10 text-[#00ff88] text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Latest
                        </div>
                    )}

                    {/* Update Available - Install Button */}
                    {hasUpdate && !isDownloading && !isInstalling && !hasInstallError && (
                        <button
                            onClick={onInstall}
                            disabled={!updateInfo?.download_url}
                            className="group flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 bg-[#00ff88] text-black hover:bg-[#00ff88]/90 hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4 group-hover:animate-bounce" />
                            Update Now
                        </button>
                    )}

                    {/* Downloading/Installing - Progress indicator */}
                    {(isDownloading || isInstalling) && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {isDownloading ? "Downloading..." : "Installing..."}
                        </div>
                    )}

                    {/* Check Error - Retry button */}
                    {hasCheckError && (
                        <button
                            onClick={onRetryCheck}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                    )}

                    {/* Install Error - Retry button */}
                    {hasInstallError && (
                        <button
                            onClick={onInstall}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                    )}

                    {/* Idle - Check button */}
                    {status === "idle" && !isDownloading && !isInstalling && !hasInstallError && (
                        <button
                            onClick={onRetryCheck}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Check
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

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
                    <div className={`mt-0.5 ${isSuccess ? "text-[#00ff88]" : isError ? "text-amber-400" : "text-white/40"} transition-colors`}>
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
                        <p className={`text-sm mt-0.5 ${isError ? "text-amber-400/80" : "text-white/40"}`}>
                            {isLoading
                                ? "Downloading engine files..."
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
                                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
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
                            Done
                        </>
                    ) : isError ? (
                        <>
                            <Wrench className="w-4 h-4" />
                            Retry
                        </>
                    ) : (
                        <>
                            <Wrench className="w-4 h-4" />
                            Repair
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default SettingsView;
