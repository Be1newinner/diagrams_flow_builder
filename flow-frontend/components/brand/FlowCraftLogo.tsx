'use client';

import React from 'react';
import Image from 'next/image';

interface FlowCraftLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showGlow?: boolean;
}

const SIZE_MAP: Record<string, { px: number; ring: string }> = {
  xs: { px: 22, ring: 'ring-1 ring-blue-500/20' },
  sm: { px: 32, ring: 'ring-2 ring-blue-500/20' },
  md: { px: 40, ring: 'ring-4 ring-blue-500/15' },
  lg: { px: 48, ring: 'ring-4 ring-blue-500/20' },
  xl: { px: 64, ring: 'ring-4 ring-blue-500/25' },
};

export function FlowCraftLogo({
  size = 'md',
  className = '',
  showGlow = true,
}: FlowCraftLogoProps) {
  const sizeConfig = typeof size === 'number'
    ? { px: size, ring: 'ring-2 ring-blue-500/20' }
    : SIZE_MAP[size] || SIZE_MAP.md;

  const px = sizeConfig.px;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs ${sizeConfig.ring} ${className}`}
      style={{ width: px, height: px }}
    >
      {showGlow && (
        <div
          className="absolute inset-0 bg-gradient-to-tr from-cyan-500/30 via-blue-600/20 to-purple-600/30 blur-xs -z-10"
        />
      )}
      <Image
        src="/logo.png"
        alt="FlowCraft Logo"
        width={px}
        height={px}
        priority
        className="w-full h-full object-cover select-none"
      />
    </div>
  );
}
