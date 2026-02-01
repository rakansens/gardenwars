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
    <header className="page-header sticky top-0 z-40 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* 戻るボタン */}
        <Link href={backHref} className="btn btn-secondary">
          ← {resolvedBackLabel}
        </Link>

        {/* タイトル */}
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>

        {/* 右側のコンテンツ */}
        <div className="flex items-center gap-2">
          {showLanguageSwitch && <LanguageSwitch />}
          {rightButton && (
            <Link href={rightButton.href} className="btn btn-primary">
              {rightButton.icon && <span>{rightButton.icon} </span>}
              {rightButton.label}
            </Link>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
