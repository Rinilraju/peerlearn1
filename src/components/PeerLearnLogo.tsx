import React from 'react';

type PeerLearnLogoProps = {
    className?: string;
};

export function PeerLearnLogo({ className = '' }: PeerLearnLogoProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            className={`text-[hsl(190_100%_50%)] drop-shadow-[0_0_8px_rgba(0,215,255,0.65)] ${className}`}
            role="img"
            aria-hidden="true"
        >
            <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
            />
            <text
                x="50%"
                y="54%"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
                fontSize="26"
                fontWeight="700"
                fill="currentColor"
                letterSpacing="1"
            >
                PL
            </text>
        </svg>
    );
}
