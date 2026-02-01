"use client";

import { ConnectionStatus as StatusType } from "@/lib/colyseus/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  status: StatusType;
  error: string | null;
  onRetry?: () => void;
}

export function ConnectionStatus({ status, error, onRetry }: Props) {
  const { t } = useLanguage();

  const getStatusDisplay = () => {
    switch (status) {
      case "disconnected":
        return { text: t("connection_disconnected"), color: "text-gray-500", icon: "⚪" };
      case "connecting":
        return { text: t("connection_connecting"), color: "text-yellow-500", icon: "🔄", animate: true };
      case "connected":
        return { text: t("connection_connected"), color: "text-green-500", icon: "🟢" };
      case "waiting":
        return { text: t("connection_waiting"), color: "text-blue-500", icon: "⏳", animate: true };
      case "countdown":
        return { text: t("connection_countdown"), color: "text-orange-500", icon: "🔥" };
      case "playing":
        return { text: t("connection_playing"), color: "text-green-600", icon: "⚔️" };
      case "finished":
        return { text: t("connection_finished"), color: "text-purple-500", icon: "🏁" };
      case "error":
        return { text: t("connection_error"), color: "text-red-500", icon: "❌" };
      default:
        return { text: status, color: "text-gray-500", icon: "❓" };
    }
  };

  const display = getStatusDisplay();

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-800/50 rounded-lg">
      <div className={`flex items-center gap-3 ${display.color}`}>
        <span className={`text-2xl ${display.animate ? "animate-spin" : ""}`}>
          {display.icon}
        </span>
        <span className="text-xl font-bold">{display.text}</span>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {(status === "error" || status === "disconnected") && onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {t("connection_retry")}
        </button>
      )}

      {status === "connecting" && (
        <p className="text-gray-400 text-sm text-center max-w-xs">
          {t("connection_server_sleep")}
        </p>
      )}
    </div>
  );
}
