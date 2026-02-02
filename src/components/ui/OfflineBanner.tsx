"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function OfflineBanner() {
    const { isOnline } = useNetwork();
    const { t } = useLanguage();

    if (isOnline) {
        return null;
    }

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 text-center shadow-lg"
            role="alert"
            aria-live="polite"
        >
            <div className="flex items-center justify-center gap-2">
                <span className="text-lg">📡</span>
                <span className="font-medium text-sm">
                    {t("offline_message") || "You are offline. Some features may not work."}
                </span>
            </div>
        </div>
    );
}
