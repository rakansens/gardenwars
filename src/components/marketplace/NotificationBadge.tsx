"use client";

interface NotificationBadgeProps {
    count: number;
    className?: string;
}

export default function NotificationBadge({ count, className = "" }: NotificationBadgeProps) {
    if (count <= 0) return null;

    return (
        <span
            className={`
                inline-flex items-center justify-center
                min-w-[20px] h-5 px-1.5
                bg-red-500 text-white
                text-xs font-bold
                rounded-full
                animate-pulse
                ${className}
            `}
        >
            {count > 99 ? "99+" : count}
        </span>
    );
}
