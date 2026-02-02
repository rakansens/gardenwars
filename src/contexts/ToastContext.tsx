"use client";

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showSuccess: (message: string, duration?: number) => void;
    showWarning: (message: string, duration?: number) => void;
    showInfo: (message: string, duration?: number) => void;
    removeToast: (id: string) => void;
    clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS: Record<ToastType, string> = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
};

const TOAST_COLORS: Record<ToastType, string> = {
    success: "bg-gradient-to-r from-emerald-500 to-green-600 text-white",
    error: "bg-gradient-to-r from-red-500 to-rose-600 text-white",
    warning: "bg-gradient-to-r from-amber-500 to-orange-600 text-white",
    info: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (message: string, type: ToastType = "info", duration: number = 4000) => {
            const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newToast: Toast = { id, message, type, duration };

            setToasts((prev) => [...prev, newToast]);

            if (duration > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, duration);
            }
        },
        [removeToast]
    );

    const showError = useCallback(
        (message: string, duration?: number) => {
            showToast(message, "error", duration ?? 5000);
        },
        [showToast]
    );

    const showSuccess = useCallback(
        (message: string, duration?: number) => {
            showToast(message, "success", duration ?? 3000);
        },
        [showToast]
    );

    const showWarning = useCallback(
        (message: string, duration?: number) => {
            showToast(message, "warning", duration ?? 4000);
        },
        [showToast]
    );

    const showInfo = useCallback(
        (message: string, duration?: number) => {
            showToast(message, "info", duration ?? 4000);
        },
        [showToast]
    );

    const clearAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider
            value={{
                toasts,
                showToast,
                showError,
                showSuccess,
                showWarning,
                showInfo,
                removeToast,
                clearAllToasts,
            }}
        >
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({
    toasts,
    onRemove,
}: {
    toasts: Toast[];
    onRemove: (id: string) => void;
}) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        ${TOAST_COLORS[toast.type]}
                        px-4 py-3 rounded-xl shadow-lg
                        flex items-center gap-3
                        animate-slide-in-right
                        pointer-events-auto
                        cursor-pointer
                        hover:scale-[1.02] transition-transform
                    `}
                    onClick={() => onRemove(toast.id)}
                    role="alert"
                >
                    <span className="text-xl flex-shrink-0">
                        {TOAST_ICONS[toast.type]}
                    </span>
                    <p className="text-sm font-medium flex-1">{toast.message}</p>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(toast.id);
                        }}
                        className="text-white/70 hover:text-white transition-colors text-lg"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// CSS animation for toast slide-in (add to globals.css)
// The animation is defined inline as a fallback
const styleTag = typeof document !== "undefined" ? document.createElement("style") : null;
if (styleTag && !document.querySelector("#toast-animations")) {
    styleTag.id = "toast-animations";
    styleTag.textContent = `
        @keyframes slide-in-right {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .animate-slide-in-right {
            animation: slide-in-right 0.3s ease-out;
        }
    `;
    document.head.appendChild(styleTag);
}
