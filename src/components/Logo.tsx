import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#shadow)" transform="translate(5, 5)">
        {/* The Main Ribbon Spiral "9" */}
        <path
          d="M35 85C55 85 88 72 88 45C88 18 65 8 45 8C25 8 8 25 8 45C8 62 22 78 38 82C48 85 78 75 78 45C78 25 62 15 45 15C30 15 18 28 18 45C18 55 22 65 32 72"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* The Gear */}
        <g transform="translate(28, 80) scale(0.95)">
          <circle cx="0" cy="0" r="13" fill="#F59E0B" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect
              key={angle}
              x="-3.5"
              y="-17"
              width="7"
              height="7"
              rx="1.5"
              fill="#F59E0B"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx="0" cy="0" r="5" fill="white" />
        </g>

        {/* The Wrench Head (Integrated into the ribbon end) */}
        <path
          d="M20 78C20 72 26 68 32 68L44 80L32 92C26 92 20 88 20 82"
          fill="white"
        />
        <path
          d="M20 80L32 80"
          stroke="#CBD5E1"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* The House */}
        <g transform="translate(52, 32) scale(1.15)">
          <path
            d="M-9 9V-2L0 -9L9 -2V9H-9Z"
            fill="#10B981"
          />
          <path
            d="M-11 0L0 -10L11 0"
            stroke="#059669"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* The Orange Arrow */}
        <path
          d="M44 54L54 42L46 42L44 54Z"
          fill="#F59E0B"
          transform="rotate(-12, 45, 45)"
        />
      </g>
    </svg>
  );
}
