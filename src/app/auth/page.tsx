"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    WelcomeScreen,
    RegisterScreen,
    LoginScreen,
    WelcomeBackScreen,
} from "@/components/auth";

type Screen = "loading" | "welcome" | "register" | "login" | "welcome-back";

export default function AuthPage() {
    const router = useRouter();
    const { status, player, register, login, logout } = useAuth();
    const [screen, setScreen] = useState<Screen>("loading");

    useEffect(() => {
        if (status === "loading") {
            setScreen("loading");
        } else if (status === "authenticated" && player) {
            setScreen("welcome-back");
        } else {
            setScreen("welcome");
        }
    }, [status, player]);

    const handleContinue = () => {
        router.push("/");
    };

    const handleSwitchPlayer = () => {
        logout();
        setScreen("welcome");
    };

    const handleRegisterComplete = async (name: string) => {
        const result = await register(name);
        return result;
    };

    const handleLoginComplete = async (pin: string) => {
        const result = await login(pin);
        if (result.success) {
            router.push("/");
        }
        return result;
    };

    // Loading state
    if (screen === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 via-green-100 to-amber-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                <div className="text-6xl animate-bounce">🌱</div>
                <p className="mt-4 text-green-700 dark:text-green-400 font-bold">Loading...</p>
            </div>
        );
    }

    // Welcome back screen (auto-login)
    if (screen === "welcome-back" && player) {
        return (
            <WelcomeBackScreen
                playerName={player.name}
                onContinue={handleContinue}
                onSwitchPlayer={handleSwitchPlayer}
            />
        );
    }

    // Register screen
    if (screen === "register") {
        return (
            <RegisterScreen
                onRegister={handleRegisterComplete}
                onBack={() => setScreen("welcome")}
            />
        );
    }

    // Login screen
    if (screen === "login") {
        return (
            <LoginScreen
                onLogin={handleLoginComplete}
                onBack={() => setScreen("welcome")}
            />
        );
    }

    // Welcome screen (default)
    return (
        <WelcomeScreen
            onNewPlayer={() => setScreen("register")}
            onExistingPlayer={() => setScreen("login")}
        />
    );
}
