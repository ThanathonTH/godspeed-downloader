import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Download,
  FolderOpen,
  Link,
  Zap,
  Clipboard,
  Activity,
  Cpu,
  Wifi
} from "lucide-react";

import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import QualitySelector from "./components/QualitySelector";
import ProgressBar from "./components/ProgressBar";
import TerminalDrawer from "./components/TerminalDrawer";
import SuccessModal from "./components/SuccessModal";
import SettingsView from "./components/SettingsView";

const MAX_LOGS = 200;
const APP_VERSION = "2.1.0";

type ViewType = "home" | "settings";

/**
 * Main application component with cyberpunk-industrial dashboard layout.
 * Implements Smart Download Lifecycle: Idle → Downloading → Success → Reset.
 */
function App() {
  // View navigation state
  const [currentView, setCurrentView] = useState<ViewType>("home");

  // Core state
  const [url, setUrl] = useState("");
  const [outputPath, setOutputPath] = useState("C:\\Downloads");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Quality and terminal state
  const [audioQuality, setAudioQuality] = useState("192k");
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalEnabled, setIsTerminalEnabled] = useState(false);

  // User preferences
  const [autoClearUrl, setAutoClearUrl] = useState(true);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [downloadedFilename, setDownloadedFilename] = useState("");
  const [downloadedFilePath, setDownloadedFilePath] = useState("");

  const isMountedRef = useRef(true);

  // When terminal is disabled, also hide it
  useEffect(() => {
    if (!isTerminalEnabled) {
      setShowTerminal(false);
    }
  }, [isTerminalEnabled]);

  // Listen for download events from Rust
  useEffect(() => {
    let unlistenProgress: UnlistenFn | undefined;
    let unlistenComplete: UnlistenFn | undefined;
    isMountedRef.current = true;

    const setupListeners = async () => {
      // Listen for progress events
      unlistenProgress = await listen<string>("download-progress", (event) => {
        if (!isMountedRef.current) return;

        const line = event.payload;

        // Limit logs to prevent memory overflow
        setLogs((prev) => [...prev.slice(-MAX_LOGS + 1), line]);

        // Auto-show terminal on error (only if terminal is enabled)
        if (line.includes("[ERROR]") || line.includes("error")) {
          if (isTerminalEnabled) {
            setShowTerminal(true);
          }
        }

        // Parse percentage from yt-dlp output: [download]  XX.X%
        const match = line.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          setProgress(Math.min(percent, 100));
        }

        // Check for completion - show success modal
        if (line.includes("completed") || line.includes("finished")) {
          setIsDownloading(false);
          setIsComplete(true);
          setProgress(100);
          setShowSuccessModal(true);
        }
      });

      // Listen for download complete event with file path
      unlistenComplete = await listen<string>("download-complete", (event) => {
        if (!isMountedRef.current) return;

        const filePath = event.payload;
        setDownloadedFilePath(filePath);

        // Extract just the filename from the full path
        const filename = filePath.split(/[\\/]/).pop() || "Download Complete";
        setDownloadedFilename(filename);
      });
    };

    setupListeners();

    return () => {
      isMountedRef.current = false;
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, [isTerminalEnabled]);

  /**
   * Open folder selection dialog.
   */
  const selectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Download Folder",
      });
      if (selected) {
        setOutputPath(selected as string);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  };

  /**
   * Paste from clipboard into URL field.
   */
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
    }
  };

  /**
   * Show the downloaded file in Windows Explorer with it highlighted.
   */
  const showFileInFolder = async () => {
    if (!downloadedFilePath) {
      console.error("No file path available");
      return;
    }

    try {
      await invoke("show_in_folder", { path: downloadedFilePath });
    } catch (error) {
      console.error("Failed to show file in folder:", error);
    }
  };

  /**
   * Start the download process via Rust backend.
   */
  const startDownload = async () => {
    if (!url.trim()) {
      setLogs((prev) => [
        ...prev.slice(-MAX_LOGS + 1),
        "[ERROR] Please enter a valid URL",
      ]);
      if (isTerminalEnabled) {
        setShowTerminal(true);
      }
      return;
    }

    setIsDownloading(true);
    setIsComplete(false);
    setProgress(0);
    setDownloadedFilename("");
    setDownloadedFilePath("");
    setLogs((prev) => [
      ...prev.slice(-MAX_LOGS + 3),
      `[GODSPEED] Starting download: ${url}`,
      `[GODSPEED] Output: ${outputPath}`,
      `[GODSPEED] Quality: ${audioQuality}`,
      "[GODSPEED] Initializing aria2c with 16 connections...",
    ]);

    try {
      await invoke("download_video", {
        url: url.trim(),
        outputPath: outputPath,
        quality: audioQuality,
      });
    } catch (error) {
      if (isMountedRef.current) {
        setLogs((prev) => [...prev.slice(-MAX_LOGS + 1), `[ERROR] ${error}`]);
        setIsDownloading(false);
        if (isTerminalEnabled) {
          setShowTerminal(true);
        }
      }
    }
  };

  /**
   * Handle successful download - reset for next download.
   * Respects the autoClearUrl user preference.
   */
  const handleDownloadSuccess = () => {
    setShowSuccessModal(false);

    // Only clear URL if user preference is enabled
    if (autoClearUrl) {
      setUrl("");
    }

    setProgress(0);
    setIsComplete(false);
    setDownloadedFilename("");
    setDownloadedFilePath("");
    // Optionally clear logs for fresh start
    setLogs([]);
  };

  /**
   * Handle showing file in folder and closing modal.
   */
  const handleShowFileAndClose = async () => {
    await showFileInFolder();
    handleDownloadSuccess();
  };

  const toggleTerminal = () => setShowTerminal((prev) => !prev);

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Title Bar */}
      <TitleBar />

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          showTerminal={showTerminal}
          onToggleTerminal={toggleTerminal}
          isTerminalEnabled={isTerminalEnabled}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* View Router with smooth transitions */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {currentView === "home" ? (
              /* Home View - Download Dashboard */
              <div
                key="home-view"
                className="flex-1 flex flex-col p-8 overflow-y-auto animate-view-enter"
              >
                {/* Header */}
                <header className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-8 h-8 text-[#00ff88]" />
                    <h1 className="text-3xl font-bold bg-linear-to-r from-[#00ff88] via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                      GODSPEED
                    </h1>
                  </div>
                  <p className="text-white/40 text-sm tracking-wide">
                    HIGH-PERFORMANCE MEDIA DOWNLOADER
                  </p>
                </header>

                {/* Glass Panel Workspace */}
                <div className="glass-panel p-6 max-w-2xl">
                  <div className="space-y-6">
                    {/* URL Input with Paste Button */}
                    <div className="space-y-2 input-focus-glow">
                      <label className="flex items-center gap-2 text-xs font-medium text-white/50 tracking-wider uppercase transition-all duration-200">
                        <Link className="w-3.5 h-3.5" />
                        Video URL
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          disabled={isDownloading}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 pr-14 text-white placeholder-white/30 focus:outline-none focus:border-[#00ff88]/50 focus:ring-2 focus:ring-[#00ff88]/20 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {/* Paste Button */}
                        <button
                          onClick={pasteFromClipboard}
                          disabled={isDownloading}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-white/40 hover:text-[#00ff88] hover:bg-white/5 rounded-lg transition-all btn-tactile disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Paste from clipboard"
                        >
                          <Clipboard className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Output Folder */}
                    <div className="space-y-2 input-focus-glow">
                      <label className="flex items-center gap-2 text-xs font-medium text-white/50 tracking-wider uppercase transition-all duration-200">
                        <FolderOpen className="w-3.5 h-3.5" />
                        Output Folder
                      </label>
                      <div className="flex gap-3">
                        <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/70 text-sm truncate">
                          {outputPath}
                        </div>
                        <button
                          onClick={selectFolder}
                          disabled={isDownloading}
                          className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all btn-tactile disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Browse
                        </button>
                      </div>
                    </div>

                    {/* Quality Selector */}
                    <QualitySelector
                      quality={audioQuality}
                      onChange={setAudioQuality}
                      disabled={isDownloading}
                    />

                    {/* Progress Bar - Smart Visibility */}
                    <ProgressBar
                      progress={progress}
                      isDownloading={isDownloading}
                      isComplete={isComplete}
                    />

                    {/* Download Button */}
                    <button
                      onClick={startDownload}
                      disabled={isDownloading || !url.trim()}
                      className="w-full py-4 rounded-xl font-bold text-lg tracking-wider transition-all duration-300 relative overflow-hidden group btn-tactile disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        background: isDownloading
                          ? "rgba(0, 255, 136, 0.1)"
                          : "linear-gradient(135deg, #00ff88 0%, #06b6d4 100%)",
                        color: isDownloading ? "rgba(0, 255, 136, 0.5)" : "#000",
                      }}
                    >
                      {/* Hover Shine Effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div
                          className="absolute inset-0"
                          style={{
                            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                            animation: "shine 0.6s ease-out",
                          }}
                        />
                      </div>

                      <span className="relative flex items-center justify-center gap-3">
                        {isDownloading ? (
                          <>
                            <LoadingSpinner />
                            DOWNLOADING...
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            START DOWNLOAD
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />
              </div>
            ) : (
              /* Settings View */
              <div
                key="settings-view"
                className="flex-1 flex flex-col overflow-hidden animate-view-enter"
              >
                <SettingsView
                  isTerminalEnabled={isTerminalEnabled}
                  onToggleTerminalEnabled={setIsTerminalEnabled}
                  autoClearUrl={autoClearUrl}
                  onToggleAutoClear={setAutoClearUrl}
                />
              </div>
            )}
          </div>

          {/* Status Bar */}
          <StatusBar isDownloading={isDownloading} />

          {/* Terminal Drawer - only render if enabled */}
          {isTerminalEnabled && (
            <TerminalDrawer
              logs={logs}
              isVisible={showTerminal}
              onClose={() => setShowTerminal(false)}
            />
          )}
        </main>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isVisible={showSuccessModal}
        onClose={handleDownloadSuccess}
        onOpenFolder={handleShowFileAndClose}
        filename={downloadedFilename || "Download Complete"}
      />
    </div>
  );
}

/**
 * Status bar showing system metrics.
 */
interface StatusBarProps {
  isDownloading: boolean;
}

function StatusBar({ isDownloading }: StatusBarProps) {
  return (
    <div className="h-8 bg-black/60 border-t border-white/5 flex items-center justify-between px-4 text-[10px] font-mono tracking-wider shrink-0">
      {/* Left side - Engine status */}
      <div className="flex items-center gap-4">
        <StatusItem
          icon={<Activity className="w-3 h-3" />}
          label="ENGINE"
          value={isDownloading ? "ACTIVE" : "STANDBY"}
          active={isDownloading}
        />
        <StatusItem
          icon={<Cpu className="w-3 h-3" />}
          label="THREADS"
          value="16"
        />
        <StatusItem
          icon={<Wifi className="w-3 h-3" />}
          label="PROTOCOL"
          value="ARIA2C"
        />
      </div>

      {/* Right side - Version */}
      <div className="flex items-center gap-2 text-white/30">
        <span>GODSPEED</span>
        <span className="text-[#00ff88]/60">v{APP_VERSION}</span>
      </div>
    </div>
  );
}

interface StatusItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  active?: boolean;
}

function StatusItem({ icon, label, value, active = false }: StatusItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={active ? "text-[#00ff88]" : "text-white/30"}>
        {icon}
      </span>
      <span className="text-white/40">{label}:</span>
      <span className={active ? "text-[#00ff88]" : "text-white/60"}>
        {value}
      </span>
    </div>
  );
}

/**
 * Loading spinner SVG component for download button.
 */
function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default App;
