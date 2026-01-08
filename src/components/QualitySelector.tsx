interface QualitySelectorProps {
    quality: string;
    onChange: (quality: string) => void;
    disabled?: boolean;
}

type QualityOption = {
    value: string;
    label: string;
    sublabel: string;
};

const QUALITY_OPTIONS: QualityOption[] = [
    { value: "128k", label: "128", sublabel: "KBPS" },
    { value: "192k", label: "192", sublabel: "KBPS" },
    { value: "256k", label: "256", sublabel: "KBPS" },
    { value: "320k", label: "320", sublabel: "KBPS" },
];

/**
 * Segmented control for audio quality selection.
 * Industrial design with glowing active state.
 * Supports 4 options: 128k, 192k, 256k, 320k
 */
function QualitySelector({ quality, onChange, disabled = false }: QualitySelectorProps) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-white/50 tracking-wider uppercase">
                Audio Quality
            </label>
            <div className="grid grid-cols-4 bg-black/40 border border-white/10 rounded-lg p-1 gap-1">
                {QUALITY_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        disabled={disabled}
                        className={`py-2.5 px-2 rounded-md text-center transition-all duration-200 ${quality === option.value
                                ? "bg-white/10 text-[#00ff88] shadow-[inset_0_0_20px_rgba(0,255,136,0.1)]"
                                : "text-white/50 hover:text-white/80 hover:bg-white/5"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <div className="flex items-baseline justify-center gap-0.5">
                            <span className={`text-base font-bold ${quality === option.value ? "text-[#00ff88]" : ""
                                }`}>
                                {option.label}
                            </span>
                            <span className="text-[9px] uppercase opacity-60">
                                {option.sublabel}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
            {/* Quality indicator */}
            <div className="flex justify-between text-[10px] text-white/30 px-1">
                <span>Smaller file</span>
                <span>Higher quality</span>
            </div>
        </div>
    );
}

export default QualitySelector;
