"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { UnitDefinition } from "@/data/types";
import RarityFrame from "./RarityFrame";

interface UnitDetailModalProps {
    unit: UnitDefinition;
    isOwned: boolean;
    isInTeam: boolean;
    onClose: () => void;
    onToggleTeam: () => void;
}

export default function UnitDetailModal({
    unit,
    isOwned,
    isInTeam,
    onClose,
    onToggleTeam,
}: UnitDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    // Prevent scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    const imageId = unit.atlasKey || unit.baseUnitId || unit.id;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 transition-opacity animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-transform animate-in zoom-in-95 duration-200"
            >
                {/* Header / Background */}
                <div className="relative h-32 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <div className="absolute top-4 right-4">
                        <button
                            onClick={onClose}
                            className="bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <h2 className="text-3xl font-bold text-white drop-shadow-md mt-4">{unit.name}</h2>
                </div>

                {/* Content */}
                <div className="px-6 py-4 -mt-12 flex flex-col items-center">
                    {/* Character Large Image */}
                    <div className="relative mb-4">
                        <RarityFrame
                            unitId={unit.id}
                            unitName={unit.name}
                            rarity={unit.rarity}
                            size="xl"
                            showLabel={true}
                            baseUnitId={unit.baseUnitId}
                        />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 w-full mb-6">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">HP</div>
                            <div className="text-lg font-bold text-gray-800">❤️ {unit.maxHp}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Attack</div>
                            <div className="text-lg font-bold text-gray-800">⚔️ {unit.attackDamage}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Cost</div>
                            <div className="text-lg font-bold text-amber-600">💰 {unit.cost}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Range</div>
                            <div className="text-lg font-bold text-indigo-600">📏 {unit.attackRange}</div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="w-full">
                        {isOwned ? (
                            <button
                                onClick={() => {
                                    onToggleTeam();
                                    onClose();
                                }}
                                className={`w-full py-3 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95 ${isInTeam
                                        ? "bg-red-500 hover:bg-red-600 text-white border-b-4 border-red-700"
                                        : "bg-green-500 hover:bg-green-600 text-white border-b-4 border-green-700"
                                    }`}
                            >
                                {isInTeam ? "チームから外す" : "チームに入れる"}
                            </button>
                        ) : (
                            <div className="w-full py-3 bg-gray-200 text-gray-500 font-bold text-center rounded-xl">
                                未所持
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
