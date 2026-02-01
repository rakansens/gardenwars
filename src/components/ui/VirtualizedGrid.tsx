"use client";

import { useRef, useMemo, useCallback, useState, useEffect, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedGridProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    getItemKey: (item: T) => string;
    // レスポンシブ列数設定
    columnConfig?: {
        default: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
    // 行の高さ（px）
    rowHeight: number;
    // グリッドギャップ（px）
    gap?: number;
    // コンテナの高さ（px） - 指定しない場合はビューポート計算
    containerHeight?: number;
    // 追加のコンテナクラス
    className?: string;
    // 空の場合の表示
    emptyContent?: ReactNode;
}

// ブレークポイント（Tailwindデフォルト）
const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
};

export default function VirtualizedGrid<T>({
    items,
    renderItem,
    getItemKey,
    columnConfig = { default: 2, sm: 3, md: 4, lg: 5, xl: 6 },
    rowHeight,
    gap = 16,
    containerHeight,
    className = "",
    emptyContent,
}: VirtualizedGridProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null);
    const [columns, setColumns] = useState(columnConfig.default);

    // レスポンシブ列数計算
    useEffect(() => {
        const calculateColumns = () => {
            const width = window.innerWidth;
            if (width >= BREAKPOINTS.xl && columnConfig.xl) {
                setColumns(columnConfig.xl);
            } else if (width >= BREAKPOINTS.lg && columnConfig.lg) {
                setColumns(columnConfig.lg);
            } else if (width >= BREAKPOINTS.md && columnConfig.md) {
                setColumns(columnConfig.md);
            } else if (width >= BREAKPOINTS.sm && columnConfig.sm) {
                setColumns(columnConfig.sm);
            } else {
                setColumns(columnConfig.default);
            }
        };

        calculateColumns();
        window.addEventListener("resize", calculateColumns);
        return () => window.removeEventListener("resize", calculateColumns);
    }, [columnConfig]);

    // 行にグループ化
    const rows = useMemo(() => {
        const result: T[][] = [];
        for (let i = 0; i < items.length; i += columns) {
            result.push(items.slice(i, i + columns));
        }
        return result;
    }, [items, columns]);

    // 仮想化設定
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => rowHeight + gap, [rowHeight, gap]),
        overscan: 3, // 前後3行分のバッファ
    });

    // コンテナの高さを計算
    const calculatedHeight = containerHeight ?? Math.min(600, rows.length * (rowHeight + gap));

    if (items.length === 0 && emptyContent) {
        return <>{emptyContent}</>;
    }

    return (
        <div
            ref={parentRef}
            className={`overflow-auto ${className}`}
            style={{ height: calculatedHeight }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                        <div
                            key={virtualRow.index}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${rowHeight}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <div
                                className="grid h-full"
                                style={{
                                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                    gap: `${gap}px`,
                                }}
                            >
                                {row.map((item, colIndex) => (
                                    <div key={getItemKey(item)} className="h-full">
                                        {renderItem(item, virtualRow.index * columns + colIndex)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
