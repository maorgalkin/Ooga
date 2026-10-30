import React, { useState } from 'react';
import { useT } from '../../hooks/useT';
import type { CategoryAccuracy } from '../../types/analytics';
import { ACCURACY_ZONE_STYLES } from '../../types/analytics';
import { formatCurrencyFromSettings, type CurrencySettings } from '../../utils/formatCurrency';

interface AccuracyTargetProps {
  accuracy: CategoryAccuracy;
  size?: number; // Size in pixels
  globalSettings?: CurrencySettings;
}

/**
 * Bullseye target visualization showing category spending accuracy
 * Renders SVG with concentric circles and a hit marker
 */
export const AccuracyTarget: React.FC<AccuracyTargetProps> = ({
  accuracy,
  size = 180,
  globalSettings,
}) => {
  const t = useT();
  const [showTooltip, setShowTooltip] = useState(false);
  
  const center = size / 2;
  const maxRadius = size * 0.45; // Leave some margin
  
  // Ring radii (from center outward) - 6 rings now
  const rings = [
    { radius: maxRadius * 0.17, zone: 'bullseye', opacity: 1 },
    { radius: maxRadius * 0.33, zone: 'ring1', opacity: 0.9 },
    { radius: maxRadius * 0.50, zone: 'ring2', opacity: 0.8 },
    { radius: maxRadius * 0.67, zone: 'ring3', opacity: 0.7 },
    { radius: maxRadius * 0.83, zone: 'ring4', opacity: 0.6 },
    { radius: maxRadius * 1.00, zone: 'ring5', opacity: 0.5 },
  ];

  // Calculate hit marker position using the deterministic angle
  const hitMarkerPosition = () => {
    if (accuracy.isUnused) {
      return { x: center, y: center, show: false };
    }

    // Position based on targetPosition (0 = center, 1 = edge, >1 = outside)
    const distance = Math.min(accuracy.targetPosition, 1.3) * maxRadius;
    
    // Use the deterministic angle from the accuracy data
    const angle = accuracy.hitAngle;
    
    return {
      x: center + distance * Math.cos(angle),
      y: center + distance * Math.sin(angle),
      show: true,
    };
  };

  const hitPos = hitMarkerPosition();
  const zoneStyle = ACCURACY_ZONE_STYLES[accuracy.accuracyZone];
  const performanceLabel = t(`insights.accuracy.zones.${accuracy.accuracyZone}`);

  const formatCurrency = (value: number) => formatCurrencyFromSettings(value, globalSettings);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`${-size * 0.15} ${-size * 0.15} ${size * 1.3} ${size * 1.3}`}
        className="drop-shadow-md"
      >
        {/* Render rings from outside to inside */}
        {[...rings].reverse().map((ring, idx) => {
          const zoneKey = ring.zone as keyof typeof ACCURACY_ZONE_STYLES;
          const style = ACCURACY_ZONE_STYLES[zoneKey];
          
          return (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={ring.radius}
              fill={accuracy.isUnused ? '#e5e7eb' : style.color}
              opacity={accuracy.isUnused ? 0.3 : ring.opacity}
              stroke={accuracy.isUnused ? '#d1d5db' : 'white'}
              strokeWidth={2}
            />
          );
        })}

        {/* Center dot */}
        <circle
          cx={center}
          cy={center}
          r={3}
          fill="white"
          opacity={0.8}
        />

        {/* Hit marker - 25% larger */}
        {hitPos.show && (
          <>
            {/* Marker shadow */}
            <circle
              cx={hitPos.x}
              cy={hitPos.y + 2}
              r={8}
              fill="black"
              opacity={0.2}
            />
            {/* Marker */}
            <circle
              cx={hitPos.x}
              cy={hitPos.y}
              r={8}
              fill={zoneStyle.color}
              stroke="white"
              strokeWidth={2.5}
              className="transition-all duration-300"
            />
            {/* Inner highlight */}
            <circle
              cx={hitPos.x - 2}
              cy={hitPos.y - 2}
              r={2}
              fill="white"
              opacity={0.6}
            />
          </>
        )}

        {/* Bust indicator (X mark) - positioned at the hit location */}
        {accuracy.accuracyZone === 'bust' && (
          <g transform={`translate(${hitPos.x}, ${hitPos.y})`}>
            <circle r={14} fill="#dc2626" stroke="white" strokeWidth={2} />
            <line x1={-6} y1={-6} x2={6} y2={6} stroke="white" strokeWidth={3} strokeLinecap="round" />
            <line x1={6} y1={-6} x2={-6} y2={6} stroke="white" strokeWidth={3} strokeLinecap="round" />
          </g>
        )}

        {/* Unused message */}
        {accuracy.isUnused && (
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-medium fill-gray-500 dark:fill-gray-400"
            style={{ fontSize: size * 0.08 }}
          >
            {t('insights.accuracy.unused')}
          </text>
        )}
      </svg>

      {/* Category label */}
      <div className="text-center mt-2">
        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate max-w-full">
          {accuracy.category}
        </div>
        <div 
          className="text-xs font-medium mt-1"
          style={{ color: zoneStyle.color }}
        >
          {accuracy.accuracyPercentage > 0 
            ? `${accuracy.accuracyPercentage.toFixed(0)}%` 
            : t('insights.accuracy.noActivity')}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl left-1/2 -translate-x-1/2 top-full mt-3">
          <div className="text-sm space-y-2">
            <div className="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              {accuracy.category}
            </div>
            
            <div className="space-y-1 text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>{t('insights.accuracy.statusLabel')}</span>
                <span className="font-medium" style={{ color: zoneStyle.color }}>
                  {performanceLabel}
                </span>
              </div>
              
              {!accuracy.isUnused && (
                <>
                  <div className="flex justify-between">
                    <span>{t('insights.accuracy.avgBudget')}</span>
                    <span className="font-medium">{formatCurrency(accuracy.budgetAverage)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('insights.accuracy.avgActual')}</span>
                    <span className="font-medium">{formatCurrency(accuracy.actualAverage)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('insights.accuracy.variance')}</span>
                    <span className={`font-medium ${accuracy.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {accuracy.isOverBudget ? '+' : ''}{formatCurrency(accuracy.variance)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{t('insights.accuracy.accuracyLabel')}</span>
                    <span className="font-medium">{accuracy.accuracyPercentage.toFixed(1)}%</span>
                  </div>
                </>
              )}
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                {accuracy.isUnused 
                  ? t('insights.accuracy.suggestion', { count: accuracy.monthsInRange })
                  : t('insights.accuracy.basedOn', { count: accuracy.monthsInRange })}
              </div>
            </div>
          </div>
          
          {/* Tooltip arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-4 h-4 bg-white dark:bg-gray-800 border-s border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};
