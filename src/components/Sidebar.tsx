import { Home, Settings, Terminal, Zap } from "lucide-react";

type ViewType = "home" | "settings";

interface SidebarProps {
    currentView: ViewType;
    onNavigate: (view: ViewType) => void;
    showTerminal: boolean;
    onToggleTerminal: () => void;
    isTerminalEnabled: boolean;
}

/**
 * Slim vertical navigation sidebar with cyberpunk-industrial styling.
 * Uses lucide-react icons for navigation between Home and Settings.
 * Terminal toggle only visible when terminal feature is enabled in settings.
 */
function Sidebar({
    currentView,
    onNavigate,
    showTerminal,
    onToggleTerminal,
    isTerminalEnabled
}: SidebarProps) {
    return (
        <aside className="w-16 bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0">
            {/* Logo */}
            <div className="h-16 flex items-center justify-center border-b border-white/5">
                <Zap className="w-6 h-6 text-[#00ff88]" />
            </div>

            {/* Navigation Icons */}
            <nav className="flex-1 flex flex-col items-center py-4 gap-2">
                <NavButton
                    icon={<Home className="w-5 h-5" />}
                    isActive={currentView === "home"}
                    tooltip="Home"
                    onClick={() => onNavigate("home")}
                />
                <NavButton
                    icon={<Settings className="w-5 h-5" />}
                    isActive={currentView === "settings"}
                    tooltip="Settings"
                    onClick={() => onNavigate("settings")}
                />
            </nav>

            {/* Terminal Toggle - Only visible when terminal is enabled */}
            {isTerminalEnabled && (
                <div className="p-3 border-t border-white/5 animate-fade-in">
                    <button
                        onClick={onToggleTerminal}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${showTerminal
                                ? "bg-[#00ff88]/20 text-[#00ff88] shadow-[0_0_15px_rgba(0,255,136,0.3)]"
                                : "text-white/50 hover:text-white/80 hover:bg-white/5"
                            }`}
                        title="Toggle Terminal"
                    >
                        <Terminal className="w-5 h-5" />
                    </button>
                </div>
            )}
        </aside>
    );
}

interface NavButtonProps {
    icon: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    onClick?: () => void;
}

function NavButton({ icon, isActive = false, tooltip, onClick }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${isActive
                    ? "bg-white/10 text-[#00ff88]"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
            title={tooltip}
        >
            {icon}
        </button>
    );
}

export default Sidebar;
