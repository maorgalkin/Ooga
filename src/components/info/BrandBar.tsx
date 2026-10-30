import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** The diagonal purple/blue/green band behind the nav bar, shared by the app and the public pages. */
export function BrandBackdrop() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-purple-600/90" style={{ clipPath: 'polygon(0 0, 35% 0, 25% 100%, 0 100%)' }} />
      <div className="absolute inset-0 bg-blue-600/90" style={{ clipPath: 'polygon(25% 0, 70% 0, 60% 100%, 15% 100%)' }} />
      <div className="absolute inset-0 bg-green-600/90" style={{ clipPath: 'polygon(60% 0, 100% 0, 100% 100%, 50% 100%)' }} />
    </div>
  );
}

/** The hexagon logo with the app name and tagline, linking home. */
export function BrandLogo({ children }: { children?: ReactNode }) {
  return (
    <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity group">
      <svg width="50" height="58" viewBox="0 0 50 58" className="drop-shadow-lg" aria-hidden>
        <path
          d="M25 0 L50 14.5 L50 43.5 L25 58 L0 43.5 L0 14.5 Z"
          fill="rgba(255, 255, 255, 0.25)"
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="2"
          className="group-hover:fill-white/30 transition-all"
        />
        <text x="25" y="38" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold" fontFamily="system-ui, -apple-system, sans-serif">
          G
        </text>
      </svg>
      <div className="flex flex-col">
        <span className="text-lg font-bold text-white drop-shadow-md leading-tight">Ooga</span>
        <span className="hidden sm:inline text-xs text-white/90 drop-shadow leading-tight">Take the Cake</span>
      </div>
      {children}
    </Link>
  );
}
