import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import wordmark from '../../assets/ooga-wordmark.svg';

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

/** The cake wordmark (the cake is the O, its slice the A) with the tagline, linking home. */
export function BrandLogo({ children }: { children?: ReactNode }) {
  return (
    <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
      <img src={wordmark} alt="Ooga" width={92} height={56} className="h-14 w-auto" />
      <span className="hidden sm:inline text-xs text-white/90 drop-shadow leading-tight">Take the Cake</span>
      {children}
    </Link>
  );
}
