"use client";

import { useEffect, useRef, ReactNode } from "react";

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

    // 外側クリックで閉じる
    useEffect(() => {
        if (!closeOnOutsideClick) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose, closeOnOutsideClick]);

    // スクロール防止
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "unset";
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
                {/* 閉じるボタン */}
                {showCloseButton && (
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors z-10"
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
                    className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95 min-h-[48px]"
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
    confirmColor?: "red" | "green" | "amber";
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
}: ConfirmModalProps) {
    const colorClasses = {
        red: "from-red-500 to-red-600",
        green: "from-green-500 to-green-600",
        amber: "from-amber-500 to-orange-500",
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
            <div className="p-6 text-center">
                <div className="text-5xl mb-4">{icon}</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
                {message && <p className="text-gray-600 mb-6">{message}</p>}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all active:scale-95 min-h-[48px]"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-6 py-3 bg-gradient-to-r ${colorClasses[confirmColor]} text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all active:scale-95 min-h-[48px]`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
