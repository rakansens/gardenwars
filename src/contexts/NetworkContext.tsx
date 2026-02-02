"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";

interface NetworkContextType {
    isOnline: boolean;
    wasOffline: boolean;
    resetWasOffline: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [wasOffline, setWasOffline] = useState<boolean>(false);

    useEffect(() => {
        // Set initial state based on navigator.onLine
        if (typeof window !== "undefined") {
            setIsOnline(navigator.onLine);
        }

        const handleOnline = () => {
            setIsOnline(true);
            // If we were offline and now online, set wasOffline flag
            setWasOffline(true);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const resetWasOffline = useCallback(() => {
        setWasOffline(false);
    }, []);

    return (
        <NetworkContext.Provider
            value={{
                isOnline,
                wasOffline,
                resetWasOffline,
            }}
        >
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error("useNetwork must be used within a NetworkProvider");
    }
    return context;
}
