import React from 'react';

interface GecCrestProps {
  size?: number;
  className?: string;
}

export const GecCrest: React.FC<GecCrestProps> = ({ size = 44, className = '' }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full flex items-center justify-center shrink-0 shadow-sm border border-amber-400/40 bg-gradient-to-br from-[#0F2A4A] via-[#1E4976] to-[#081B30] text-amber-300 font-serif font-bold ${className}`}
      title="Government Engineering College, Bidar"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-0.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Ring */}
        <circle cx="50" cy="50" r="46" stroke="#E8A33D" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="41" stroke="#FDE68A" strokeWidth="0.75" strokeDasharray="3 2" />
        
        {/* Heraldic Wheel / Gear Elements */}
        <circle cx="50" cy="50" r="30" fill="#0F2A4A" stroke="#E8A33D" strokeWidth="1.5" />

        {/* Traditional Lamp of Knowledge & Open Book Motif */}
        {/* Book */}
        <path
          d="M32 58 C 42 54, 48 57, 50 60 C 52 57, 58 54, 68 58 L 68 64 C 58 60, 52 63, 50 66 C 48 63, 42 60, 32 64 Z"
          fill="#FFF"
          stroke="#E8A33D"
          strokeWidth="0.8"
        />
        {/* Central Flame / Jyothi */}
        <path
          d="M50 32 C 45 42, 50 48, 50 51 C 50 48, 55 42, 50 32 Z"
          fill="#F59E0B"
        />
        <circle cx="50" cy="46" r="2" fill="#FEF08A" />

        {/* Text Monogram */}
        <text
          x="50"
          y="26"
          textAnchor="middle"
          fill="#FDE68A"
          fontSize="7.5"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          letterSpacing="1"
        >
          GEC BIDAR
        </text>
        <text
          x="50"
          y="76"
          textAnchor="middle"
          fill="#93C5FD"
          fontSize="5.5"
          fontWeight="600"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.8"
        >
          ESTD 2017 · VTU
        </text>
      </svg>
    </div>
  );
};
