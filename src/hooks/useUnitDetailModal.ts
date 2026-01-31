"use client";

import { useState, useCallback } from "react";
import type { UnitDefinition } from "@/data/types";

/**
 * ユニット詳細モーダルの状態管理用カスタムフック
 *
 * Usage:
 * ```tsx
 * const { viewingUnit, openModal, closeModal } = useUnitDetailModal();
 *
 * // Open modal
 * <div onClick={() => openModal(unit)}>...</div>
 *
 * // Render modal
 * {viewingUnit && (
 *   <UnitDetailModal unit={viewingUnit} onClose={closeModal} ... />
 * )}
 * ```
 */
export function useUnitDetailModal() {
    const [viewingUnit, setViewingUnit] = useState<UnitDefinition | null>(null);

    const openModal = useCallback((unit: UnitDefinition) => {
        setViewingUnit(unit);
    }, []);

    const closeModal = useCallback(() => {
        setViewingUnit(null);
    }, []);

    return {
        viewingUnit,
        openModal,
        closeModal,
        isOpen: viewingUnit !== null,
    };
}

export default useUnitDetailModal;
