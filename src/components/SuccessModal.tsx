import { CheckCircle, FolderOpen, X } from "lucide-react";

interface SuccessModalProps {
    isVisible: boolean;
    onClose: () => void;
    onOpenFolder?: () => void;
    filename?: string;
}

/**
 * Industrial-style success modal with pop-in animation.
 * Displays download completion feedback with actions.
 */
function SuccessModal({
    isVisible,
    onClose,
    onOpenFolder,
    filename = "File Saved Successfully"
}: SuccessModalProps) {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-dark-800/95 backdrop-blur-xl border border-[#00ff88]/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-[0_0_60px_rgba(0,255,136,0.15)] animate-modal-pop">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80 transition-colors btn-tactile"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#00ff88]/20 rounded-full blur-xl animate-pulse" />
                        <div className="relative w-20 h-20 bg-[#00ff88]/10 rounded-full flex items-center justify-center border border-[#00ff88]/30">
                            <CheckCircle className="w-10 h-10 text-[#00ff88]" />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-white mb-2">
                    Download Complete
                </h2>

                {/* Filename/Description */}
                <p className="text-center text-white/50 text-sm mb-8 font-mono truncate px-4">
                    {filename}
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    {onOpenFolder && (
                        <button
                            onClick={onOpenFolder}
                            className="flex-1 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all btn-tactile flex items-center justify-center gap-2"
                        >
                            <FolderOpen className="w-4 h-4" />
                            Open Folder
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all btn-tactile text-black"
                        style={{
                            background: "linear-gradient(135deg, #00ff88 0%, #06b6d4 100%)",
                        }}
                    >
                        OK
                    </button>
                </div>

                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-[#00ff88]/30 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-[#00ff88]/30 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-[#00ff88]/30 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-[#00ff88]/30 rounded-br-2xl" />
            </div>
        </div>
    );
}

export default SuccessModal;
