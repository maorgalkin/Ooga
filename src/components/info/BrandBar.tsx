import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

/** The wordmark (its second o is a pie with a slice taken) with the tagline, linking home. */
export function BrandLogo({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
      <img src={wordmark} alt="Ooga" width={146} height={56} className="h-11 sm:h-14 w-auto" />
      <span className="hidden sm:inline text-xs text-white/90 drop-shadow leading-tight">{t('brand.tagline')}</span>
      {children}
    </Link>
  );
}
