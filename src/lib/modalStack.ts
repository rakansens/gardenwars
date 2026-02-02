/**
 * Modal Stack Manager
 *
 * Implements reference counting for scroll prevention to handle nested/stacked modals.
 * Only restores scroll when ALL modals are closed.
 */

let modalStackCount = 0;
let originalOverflow: string | null = null;

/**
 * Push a modal onto the stack.
 * Disables body scroll on the first modal.
 */
export function pushModal(): void {
    if (typeof document === "undefined") return; // SSR guard

    if (modalStackCount === 0) {
        originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    modalStackCount++;
}

/**
 * Pop a modal from the stack.
 * Restores body scroll only when all modals are closed.
 */
export function popModal(): void {
    if (typeof document === "undefined") return; // SSR guard

    modalStackCount--;
    if (modalStackCount === 0) {
        document.body.style.overflow = originalOverflow ?? "unset";
        originalOverflow = null;
    }
    // Ensure count never goes negative
    if (modalStackCount < 0) {
        modalStackCount = 0;
    }
}

/**
 * Get the current modal stack count (useful for debugging).
 */
export function getModalStackCount(): number {
    return modalStackCount;
}

/**
 * Reset the modal stack (use for cleanup in tests or error recovery).
 */
export function resetModalStack(): void {
    if (typeof document === "undefined") return; // SSR guard

    modalStackCount = 0;
    if (originalOverflow !== null) {
        document.body.style.overflow = originalOverflow;
        originalOverflow = null;
    }
}
