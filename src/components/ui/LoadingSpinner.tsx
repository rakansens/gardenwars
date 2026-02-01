"use client";

import { useLanguage } from "@/contexts/LanguageContext";

interface LoadingSpinnerProps {
  /** アイコン（絵文字） */
  icon?: string;
  /** テキストを表示するか */
  showText?: boolean;
  /** カスタムテキスト */
  text?: string;
  /** サイズ */
  size?: "sm" | "md" | "lg";
  /** フルスクリーンモード */
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  icon = "⏳",
  showText = true,
  text,
  size = "md",
  fullScreen = false,
}: LoadingSpinnerProps) {
  const { t } = useLanguage();
  const displayText = text || t("loading");

  const sizeClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizeClasses[size]} animate-bounce`}>{icon}</div>
      {showText && (
        <p className={`text-amber-700 dark:text-amber-300 font-medium ${textSizeClasses[size]}`}>
          {displayText}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
