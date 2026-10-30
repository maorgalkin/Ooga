import React from 'react';
import { motion } from 'framer-motion';
import { isRtl } from '../../i18n';

interface MonthData {
  label: string;
  monthName: string;
  year: string;
  start: Date;
  end: Date;
}

interface MonthCarouselProps {
  months: MonthData[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

// Responsive card width based on screen size
const MOBILE_CARD_WIDTH = 140;
const DESKTOP_CARD_WIDTH = 180;

export const MonthCarousel: React.FC<MonthCarouselProps> = ({
  months,
  activeIndex,
  onIndexChange,
}) => {
  const isDisabled = months.length <= 1;

  // Get the 3 visible cards: prev, current, next (with wrapping)
  const getVisibleCards = () => {
    if (months.length === 0) return [];
    
    const totalMonths = months.length;
    const prevIndex = (activeIndex - 1 + totalMonths) % totalMonths;
    const nextIndex = (activeIndex + 1) % totalMonths;
    
    return [
      { ...months[prevIndex], position: 'left', index: prevIndex },
      { ...months[activeIndex], position: 'center', index: activeIndex },
      { ...months[nextIndex], position: 'right', index: nextIndex },
    ];
  };

  const visibleCards = getVisibleCards();

  const handlePrevious = () => {
    const newIndex = (activeIndex - 1 + months.length) % months.length;
    onIndexChange(newIndex);
  };

  const handleNext = () => {
    const newIndex = (activeIndex + 1) % months.length;
    onIndexChange(newIndex);
  };

  return (
    <div className="relative w-full py-4 sm:py-8">
      {/* Cards Container */}
      <div className="flex justify-center items-center h-32 sm:h-40 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {/* Left Arrow */}
        {!isDisabled && (
          <button
            onClick={handlePrevious}
            className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-700 transition-all shadow-lg flex-shrink-0"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Three Cards */}
        <div className="flex gap-2 sm:gap-4 items-center">
            {visibleCards.map((card) => {
              const isActive = card.position === 'center';
              const isSideCard = card.position !== 'center';
              
              return (
                <motion.button
                  key={card.position}
                  onClick={() => !isDisabled && onIndexChange(card.index)}
                  disabled={isDisabled}
                  animate={{ 
                    opacity: isActive ? 1 : 0.5,
                    scale: isActive ? 1 : 0.85,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 25
                  }}
                  className={`flex-shrink-0 h-24 sm:h-32 rounded-lg sm:rounded-xl border-2 font-medium flex flex-col items-center justify-center transition-colors ${
                    isSideCard ? 'hidden sm:flex' : ''
                  } ${
                    isActive
                      ? 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-500 shadow-xl'
                      : 'bg-white dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500'
                  } ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}
                  style={{
                    width: isSideCard ? DESKTOP_CARD_WIDTH : `min(${MOBILE_CARD_WIDTH}px, 80vw)`,
                  }}
                >
                  <div className={`text-lg sm:text-xl ${isActive ? 'font-bold' : 'font-semibold'}`}>
                    {card.monthName}
                  </div>
                  <div className={`text-sm sm:text-base ${isActive ? 'font-medium' : 'font-normal'} mt-0.5 sm:mt-1 opacity-90`}>
                    {card.year}
                  </div>
                </motion.button>
              );
            })}
        </div>

        {/* Right Arrow */}
        {!isDisabled && (
          <button
            onClick={handleNext}
            className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-700 transition-all shadow-lg flex-shrink-0"
            aria-label="Next month"
          >
            <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Month Indicator Dots - Scrollable with draggable active indicator */}
      {!isDisabled && months.length > 1 && (
        <div className="relative max-w-3xl mx-auto">
          <div className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-blue-300 dark:scrollbar-thumb-blue-700 scrollbar-track-transparent">
            <div className="flex justify-center gap-2 px-4 py-2 min-w-max relative">
              {months.map((month, idx) => {
                const isActive = idx === activeIndex;
                
                if (isActive) {
                  return (
                    <motion.button
                      key={idx}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.3}
                      dragMomentum={true}
                      onDrag={(_event, info) => {
                        // Calculate which dot we're over based on drag position
                        const dotWidth = 8 + 8; // width (8px) + gap (8px)
                        // The dots run right to left in RTL, so a drag to the right means earlier months
                        const offset = isRtl() ? -info.offset.x : info.offset.x;
                        
                        // How many dots away from current position
                        const deltaIndex = Math.round(offset / dotWidth);
                        const newIndex = activeIndex + deltaIndex;
                        const clampedIndex = Math.max(0, Math.min(months.length - 1, newIndex));
                        
                        if (clampedIndex !== activeIndex) {
                          onIndexChange(clampedIndex);
                        }
                      }}
                      onClick={() => onIndexChange(idx)}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30
                      }}
                      className="flex-shrink-0 h-2 w-12 bg-blue-600 dark:bg-blue-400 rounded-full cursor-grab active:cursor-grabbing transition-all"
                      aria-label={`Go to ${month.monthName} ${month.year}`}
                      title={`${month.monthName} ${month.year}`}
                    />
                  );
                }
                
                return (
                  <button
                    key={idx}
                    onClick={() => onIndexChange(idx)}
                    className="flex-shrink-0 h-2 w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 rounded-full transition-all"
                    aria-label={`Go to ${month.monthName} ${month.year}`}
                    title={`${month.monthName} ${month.year}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
