"use client";

interface TabItem {
    id: string;
    label: string;
    icon: string;
}

interface GachaTabsProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (id: string) => void;
}

export default function GachaTabs({ tabs, activeTab, onTabChange }: GachaTabsProps) {
    return (
        <div className="flex justify-center mb-6">
            <div className="bg-white/50 dark:bg-black/30 p-1.5 rounded-2xl backdrop-blur-sm shadow-sm inline-flex gap-1 overflow-x-auto max-w-full">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                                px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap
                                ${isActive
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md scale-105"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/10"
                                }
                            `}
                        >
                            <span className={isActive ? "animate-pulse" : ""}>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
