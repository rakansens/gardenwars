"use client";

import { useEffect, useRef, useCallback, ReactNode } from "react";
import { pushModal, popModal } from "@/lib/modalStack";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    /** モーダルのサイズ */
    size?: "sm" | "md" | "lg";
    /** 外側クリックで閉じるか */
    closeOnOutsideClick?: boolean;
    /** 閉じるボタンを表示するか */
    showCloseButton?: boolean;
    /** カスタムクラス */
    className?: string;
}

export default function Modal({
    isOpen,
    onClose,
    children,
    size = "sm",
    closeOnOutsideClick = true,
    showCloseButton = true,
    className = "",
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // ESC key handler for keyboard accessibility
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === "Escape") {
            onClose();
        }
    }, [onClose]);

    // 外側クリックで閉じる + ESCキー
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (closeOnOutsideClick && modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose, closeOnOutsideClick, handleKeyDown]);

    // スクロール防止 with modal stacking support
    useEffect(() => {
        if (isOpen) {
            pushModal();
        }
        return () => {
            if (isOpen) {
                popModal();
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className={`
                    bg-white rounded-2xl w-full ${sizeClasses[size]} shadow-2xl
                    transform transition-transform animate-in zoom-in-95 duration-200
                    my-auto sm:my-4 relative
                    ${className}
                `}
            >
                {/* 閉じるボタン - 44x44px minimum for touch accessibility */}
                {showCloseButton && (
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 w-11 h-11 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors z-10"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                )}

                {children}
            </div>
        </div>
    );
}

// サクセスモーダル用のプリセット
interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    icon?: string;
    title: string;
    message?: string;
    buttonText?: string;
}

export function SuccessModal({
    isOpen,
    onClose,
    icon = "✅",
    title,
    message,
    buttonText = "OK",
}: SuccessModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
            <div className="p-6 text-center">
                <div className="text-5xl mb-4">{icon}</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
                {message && <p className="text-gray-600 mb-6">{message}</p>}
                <button
                    onClick={onClose}
                    className="btn btn-primary px-8"
                >
                    {buttonText}
                </button>
            </div>
        </Modal>
    );
}

// 確認モーダル用のプリセット
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    icon?: string;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: "red" | "green" | "amber" | "blue" | "purple" | "pink";
    isLoading?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    icon = "❓",
    title,
    message,
    confirmText = "OK",
    cancelText = "キャンセル",
    confirmColor = "amber",
    isLoading = false,
}: ConfirmModalProps) {
    const colorClasses = {
        red: "bg-gradient-to-r from-red-500 to-red-600 border-red-400 hover:from-red-600 hover:to-red-700",
        green: "bg-gradient-to-r from-green-500 to-green-600 border-green-400 hover:from-green-600 hover:to-green-700",
        amber: "bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 hover:from-amber-600 hover:to-orange-600",
        blue: "bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400 hover:from-blue-600 hover:to-blue-700",
        purple: "bg-gradient-to-r from-purple-500 to-purple-600 border-purple-400 hover:from-purple-600 hover:to-purple-700",
        pink: "bg-gradient-to-r from-pink-500 to-pink-600 border-pink-400 hover:from-pink-600 hover:to-pink-700",
    };

    return (
        <Modal isOpen={isOpen} onClose={isLoading ? () => { } : onClose} showCloseButton={false} closeOnOutsideClick={!isLoading}>
            <div className="p-6 text-center">
                <div className="text-5xl mb-4">{isLoading ? <span className="animate-spin inline-block">⏳</span> : icon}</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
                {message && <p className="text-gray-600 mb-6">{message}</p>}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary px-6"
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                        }}
                        disabled={isLoading}
                        className={`btn btn-primary px-6 text-white border-0 ${colorClasses[confirmColor]} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="animate-spin">⏳</span>
                                {confirmText}
                            </span>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
