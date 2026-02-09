"use client";

import Link from "next/link";
import { useLanguage, LanguageSwitch } from "@/contexts/LanguageContext";
import { ReactNode } from "react";

// ============================================
// PageHeader - 共通スティッキーヘッダー
// ============================================

interface PageHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
  rightButton?: {
    href: string;
    label: string;
    icon?: string;
  };
  showLanguageSwitch?: boolean;
  children?: ReactNode;
}

export default function PageHeader({
  title,
  backHref = "/",
  backLabel,
  rightButton,
  showLanguageSwitch = true,
  children,
}: PageHeaderProps) {
  const { t } = useLanguage();

  const resolvedBackLabel = backLabel || t("back_to_home");

  return (
    <header className="page-header sticky top-0 z-40 mb-4 md:mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 md:gap-3">
        {/* 戻るボタン */}
        <Link href={backHref} className="btn btn-secondary text-xs md:text-sm py-1.5 px-2 md:py-2 md:px-3">
          ← {resolvedBackLabel}
        </Link>

        {/* タイトル */}
        <h1 className="text-lg md:text-3xl font-bold">{title}</h1>

        {/* 右側のコンテンツ */}
        <div className="flex items-center gap-1 md:gap-2">
          {showLanguageSwitch && <LanguageSwitch />}
          {rightButton && (
            <Link href={rightButton.href} className="btn btn-primary text-xs md:text-sm py-1.5 px-2 md:py-2 md:px-3">
              {rightButton.icon && <span>{rightButton.icon} </span>}
              <span className="hidden sm:inline">{rightButton.label}</span>
            </Link>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
