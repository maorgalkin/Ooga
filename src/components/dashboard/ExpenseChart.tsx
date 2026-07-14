import React, { useEffect, useRef, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Sector } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { getCategoryColor } from '../../utils/categoryColors';
import type { Transaction } from '../../types';
import type { PersonalBudget } from '../../types/budget';
import { getUserLocale } from '../../utils/locale';

interface CategoryData {
  category: string;
  amount: number;
}

interface ExpenseChartProps {
  categoryData: CategoryData[];
  transactions: Transaction[];
  personalBudget: PersonalBudget | null | undefined;
  formatCurrency: (amount: number) => string;
  selectedCategory?: string | null;
  onEditTransaction: (transaction: Transaction) => void;
  onViewAllTransactions: (category: string) => void;
  /** Called when the user dismisses the transaction list (X button) */
  onDeselect?: () => void;
  /** Called when a pie slice is clicked on desktop, so the parent can sync selection state */
  onCategorySelect?: (category: string) => void;
}

type Point = { x: number; y: number };

interface LensState {
  isVisible: boolean;
  origin: Point;
  pointer: Point;
  center: Point;
}

interface PointerState {
  isActive: boolean;
  pointerType: string;
  x: number;
  y: number;
}

const createLensState = (): LensState => ({
  isVisible: false,
  origin: { x: 0, y: 0 },
  pointer: { x: 0, y: 0 },
  center: { x: 0, y: 0 },
});

interface BoundsSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Interactive pie chart for expense breakdown by category
 * Desktop: Click to show transaction list in side panel
 * Mobile: Tap to show category details below chart
 */
export const ExpenseChart: React.FC<ExpenseChartProps> = ({
  categoryData,
  transactions,
  personalBudget,
  formatCurrency,
  selectedCategory,
  onEditTransaction,
  onViewAllTransactions,
  onDeselect,
  onCategorySelect,
}) => {
  const [selectedDesktopCategory, setSelectedDesktopCategory] = useState<string | null>(selectedCategory || null);

  // Sync external selectedCategory prop (e.g. driven by tile click in DashboardTileLayout)
  useEffect(() => {
    setSelectedDesktopCategory(selectedCategory ?? null);
  }, [selectedCategory]);
  const [focusedCategory, setFocusedCategory] = useState<{
    category: string;
    amount: number;
    percentage: string;
  } | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const playgroundRef = useRef<HTMLDivElement>(null);
  const [playgroundLogs, setPlaygroundLogs] = useState<string[]>([]);
  const [playgroundPointerState, setPlaygroundPointerState] = useState<PointerState>({
    isActive: false,
    pointerType: '',
    x: 0,
    y: 0,
  });
  const [playgroundLensState, setPlaygroundLensState] = useState<LensState>(createLensState());
  const playgroundPointerIdRef = useRef<number | null>(null);
  const playgroundStartPositionRef = useRef<Point | null>(null);
  const playgroundLongPressTimerRef = useRef<number | null>(null);
  const playgroundBoundsRef = useRef<BoundsSnapshot | null>(null);
  const [playgroundLastSelection, setPlaygroundLastSelection] = useState<{ x: number; y: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartPointerIdRef = useRef<number | null>(null);
  const chartStartPositionRef = useRef<Point | null>(null);
  const chartLongPressTimerRef = useRef<number | null>(null);
  const chartBoundsRef = useRef<BoundsSnapshot | null>(null);
  const [chartPointerState, setChartPointerState] = useState<PointerState>({
    isActive: false,
    pointerType: '',
    x: 0,
    y: 0,
  });
  const [chartLensState, setChartLensState] = useState<LensState>(createLensState());

  const playgroundLensSize = 160;
  const playgroundLensRadius = playgroundLensSize / 2;
  const playgroundLensZoom = 2.4;
  const chartLensSize = 160;
  const chartLensZoom = 2.4;
  const showMagnifierPlayground = false;

  const logPlayground = (message: string) => {
    setPlaygroundLogs(prev => {
      const next = [`${new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })} ${message}`, ...prev];
      return next.slice(0, 6);
    });
  };

  const snapshotBounds = (element: HTMLElement | null): BoundsSnapshot | null => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const getRelativePositionFromBounds = (
    bounds: BoundsSnapshot | null,
    event: React.PointerEvent,
  ): Point => {
    if (!bounds) {
      return { x: event.clientX, y: event.clientY };
    }
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const clampLensCenter = (value: Point, bounds: BoundsSnapshot | null, lensSize: number) => {
    const width = bounds?.width ?? lensSize;
    const height = bounds?.height ?? lensSize;
    return {
      x: Math.min(Math.max(value.x, 0), width),
      y: Math.min(Math.max(value.y, 0), height),
    };
  };

  const computeLensCenter = (
    point: Point,
    bounds: BoundsSnapshot | null,
    lensSize: number,
    pointerType: string = 'mouse'
  ) => {
    // Only offset upward on touch to avoid finger occlusion
    const fingerOffset = pointerType === 'touch' ? 80 : 0;
    
    // First, clamp the pointer position (where the finger is)
    const clampedPointer = clampLensCenter(point, bounds, lensSize);
    
    // Then offset the lens center upward from the finger position
    return {
      x: clampedPointer.x,
      y: Math.max(0, clampedPointer.y - fingerOffset),
    };
  };

  const getPlaygroundRelativePosition = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!playgroundBoundsRef.current) {
      playgroundBoundsRef.current = snapshotBounds(playgroundRef.current);
    }
    return getRelativePositionFromBounds(playgroundBoundsRef.current, event);
  };

  const getChartRelativePosition = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!chartBoundsRef.current) {
      const container = chartContainerRef.current ?? (event.currentTarget as HTMLElement | null);
      chartBoundsRef.current = snapshotBounds(container);
    }
    return getRelativePositionFromBounds(chartBoundsRef.current, event);
  };

  const clearPlaygroundLongPressTimer = () => {
    if (playgroundLongPressTimerRef.current !== null) {
      window.clearTimeout(playgroundLongPressTimerRef.current);
      playgroundLongPressTimerRef.current = null;
      logPlayground('long-press timer cleared');
    }
  };

  const clearChartLongPressTimer = () => {
    if (chartLongPressTimerRef.current !== null) {
      window.clearTimeout(chartLongPressTimerRef.current);
      chartLongPressTimerRef.current = null;
    }
  };

  const handlePlaygroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) {
      return;
    }

    const relative = getPlaygroundRelativePosition(event);
    playgroundBoundsRef.current = snapshotBounds(event.currentTarget as HTMLElement);
    const pointerType = event.pointerType || playgroundPointerState.pointerType || 'mouse';

    logPlayground(`pointerdown (${pointerType})`);

    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
      logPlayground('pointer captured');
      playgroundPointerIdRef.current = event.pointerId;
    } catch (error) {
      logPlayground('pointer capture failed');
    }

    playgroundStartPositionRef.current = relative;

    setPlaygroundPointerState({
      isActive: true,
      pointerType,
      x: relative.x,
      y: relative.y,
    });

    if (playgroundLongPressTimerRef.current !== null) {
      clearPlaygroundLongPressTimer();
    }

    const delay = pointerType === 'touch' ? 450 : 250;
    const nextCenter = computeLensCenter(
      relative,
      playgroundBoundsRef.current,
      playgroundLensSize,
      pointerType,
    );
    playgroundLongPressTimerRef.current = window.setTimeout(() => {
      logPlayground('long-press timer fired -> show lens');
      setPlaygroundLensState({
        isVisible: true,
        origin: relative,
        pointer: relative,
        center: nextCenter,
      });
      playgroundLongPressTimerRef.current = null;
    }, delay);
  };

  const handlePlaygroundPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!playgroundPointerState.isActive) {
      return;
    }

    const relative = getPlaygroundRelativePosition(event);
    const pointerType = event.pointerType || playgroundPointerState.pointerType || 'mouse';
    const nextCenter = computeLensCenter(
      relative,
      playgroundBoundsRef.current,
      playgroundLensSize,
      pointerType,
    );

    if (
      playgroundLongPressTimerRef.current !== null &&
      playgroundStartPositionRef.current
    ) {
      const dx = relative.x - playgroundStartPositionRef.current.x;
      const dy = relative.y - playgroundStartPositionRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 20) {
        logPlayground('movement > 20px -> cancel lens timer');
        clearPlaygroundLongPressTimer();
      }
    }

    setPlaygroundPointerState(prev => ({
      ...prev,
      x: relative.x,
      y: relative.y,
      pointerType,
    }));

    setPlaygroundLensState(prev =>
      prev.isVisible
        ? {
            ...prev,
            pointer: relative,
            center: nextCenter,
          }
        : prev
    );
  };

  const handlePlaygroundPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!playgroundPointerState.isActive) {
      return;
    }

    logPlayground('pointerup');
    clearPlaygroundLongPressTimer();

    const relative = getPlaygroundRelativePosition(event);
    const pointerType = event.pointerType || playgroundPointerState.pointerType || 'mouse';
    const selectionPoint = playgroundLensState.isVisible
      ? playgroundLensState.center
      : relative;

    logPlayground(`selection fired at ${Math.round(selectionPoint.x)}x${Math.round(selectionPoint.y)}`);
    setPlaygroundLastSelection(selectionPoint);

    try {
      const target = event.currentTarget as Element;
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
        logPlayground('pointer released');
      }
    } catch (error) {
      logPlayground('pointer release failed');
    }

    playgroundPointerIdRef.current = null;
    playgroundStartPositionRef.current = null;

    setPlaygroundLensState(prev =>
      prev.isVisible
        ? {
            ...prev,
            isVisible: false,
            pointer: relative,
            center: computeLensCenter(
              relative,
              playgroundBoundsRef.current,
              playgroundLensSize,
            ),
          }
        : prev
    );

    setPlaygroundPointerState({
      isActive: false,
      pointerType,
      x: relative.x,
      y: relative.y,
    });
  };

  const handleChartPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) {
      return;
    }

    chartContainerRef.current = event.currentTarget as HTMLDivElement;
    chartBoundsRef.current = snapshotBounds(chartContainerRef.current);
    const relative = getChartRelativePosition(event);
    const pointerType = event.pointerType || chartPointerState.pointerType || 'mouse';

    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
      chartPointerIdRef.current = event.pointerId;
    } catch (error) {
      // Ignore capture failures (Safari sometimes throws)
    }

    chartStartPositionRef.current = relative;
    setChartPointerState({
      isActive: true,
      pointerType,
      x: relative.x,
      y: relative.y,
    });

    if (chartLongPressTimerRef.current !== null) {
      clearChartLongPressTimer();
    }

    const delay = pointerType === 'touch' ? 450 : 250;
    const nextCenter = computeLensCenter(
      relative,
      chartBoundsRef.current,
      chartLensSize,
      pointerType,
    );

    chartLongPressTimerRef.current = window.setTimeout(() => {
      setChartLensState({
        isVisible: true,
        origin: relative,
        pointer: relative,
        center: nextCenter,
      });
      chartLongPressTimerRef.current = null;
    }, delay);
  };

  const handleChartPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!chartPointerState.isActive) {
      return;
    }

    const relative = getChartRelativePosition(event);
    const pointerType = event.pointerType || chartPointerState.pointerType || 'mouse';
    const nextCenter = computeLensCenter(
      relative,
      chartBoundsRef.current,
      chartLensSize,
      pointerType,
    );

    if (
      chartLongPressTimerRef.current !== null &&
      chartStartPositionRef.current
    ) {
      const dx = relative.x - chartStartPositionRef.current.x;
      const dy = relative.y - chartStartPositionRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 20) {
        clearChartLongPressTimer();
      }
    }

    setChartPointerState({
      isActive: true,
      pointerType,
      x: relative.x,
      y: relative.y,
    });

    // Detect hovered category for visual feedback
    const bounds = chartBoundsRef.current ?? snapshotBounds(chartContainerRef.current);
    if (bounds) {
      const globalPoint = { x: bounds.left + relative.x, y: bounds.top + relative.y };
      const detectedCategory = detectCategoryAtGlobalPoint(globalPoint);
      setHoveredCategory(detectedCategory);
    }

    setChartLensState(prev =>
      prev.isVisible
        ? {
            ...prev,
            pointer: relative,
            center: nextCenter,
          }
        : prev
    );
  };

  const handleChartPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!chartPointerState.isActive) {
      return;
    }

    const relative = getChartRelativePosition(event);
    const pointerType = event.pointerType || chartPointerState.pointerType || 'mouse';

    clearChartLongPressTimer();

    try {
      const target = event.currentTarget as Element;
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      // Ignore release failures
    }

    chartPointerIdRef.current = null;
    chartStartPositionRef.current = null;

    // Clear hover state
    setHoveredCategory(null);

    // Use pointer position (where finger is) not center (where lens is drawn)
    const selectionPoint = chartLensState.isVisible
      ? chartLensState.pointer
      : relative;

    if (chartLensState.isVisible || pointerType === 'mouse' || pointerType === 'touch') {
      const bounds = chartBoundsRef.current ?? snapshotBounds(chartContainerRef.current);
      const globalPoint = bounds
        ? { x: bounds.left + selectionPoint.x, y: bounds.top + selectionPoint.y }
        : { x: selectionPoint.x, y: selectionPoint.y };
      const detectedCategory = detectCategoryAtGlobalPoint(globalPoint);
      if (detectedCategory) {
        const entry = categoryData.find(cat => cat.category === detectedCategory);
        if (entry) {
          handleCategoryClick(entry);
        }
      }
    }

    setChartLensState(prev =>
      prev.isVisible
        ? {
            ...prev,
            isVisible: false,
            pointer: relative,
            center: computeLensCenter(
              relative,
              chartBoundsRef.current,
              chartLensSize,
            ),
          }
        : prev
    );

    setChartPointerState({
      isActive: false,
      pointerType,
      x: relative.x,
      y: relative.y,
    });
  };

  const detectCategoryAtGlobalPoint = (point: Point): string | null => {
    const elements = document.elementsFromPoint(point.x, point.y);
    for (const element of elements) {
      if (!(element instanceof Element)) {
        continue;
      }
      const withData = element.closest('[data-category]');
      if (withData) {
        const category = withData.getAttribute('data-category');
        if (category) {
          return category;
        }
      }
    }
    return null;
  };

  useEffect(() => {
    return () => {
      if (playgroundLongPressTimerRef.current !== null) {
        window.clearTimeout(playgroundLongPressTimerRef.current);
      }
      if (chartLongPressTimerRef.current !== null) {
        window.clearTimeout(chartLongPressTimerRef.current);
      }
    };
  }, []);

  // Update selected category when prop changes
  useEffect(() => {
    if (selectedCategory) {
      setSelectedDesktopCategory(selectedCategory);
      
      // For mobile: also set focusedCategory
      const categoryItem = categoryData.find(c => c.category === selectedCategory);
      if (categoryItem) {
        const totalAmount = categoryData.reduce((sum, cat) => sum + cat.amount, 0);
        const percentage = ((categoryItem.amount / totalAmount) * 100).toFixed(1);
        setFocusedCategory({
          category: categoryItem.category,
          amount: categoryItem.amount,
          percentage
        });
      }
    }
  }, [selectedCategory, categoryData]);

  const handleCategoryClick = (entry: CategoryData) => {
    const totalAmount = categoryData.reduce((sum, cat) => sum + cat.amount, 0);
    const percentage = ((entry.amount / totalAmount) * 100).toFixed(1);

    // On mobile, set focused category to show transactions
    if (window.innerWidth < 768) {
      setFocusedCategory({
        category: entry.category,
        amount: entry.amount,
        percentage
      });
    } else {
      // On desktop, set selected category for side panel
      setSelectedDesktopCategory(entry.category);
      onCategorySelect?.(entry.category);
    }
  };

  // Index of the currently selected slice (for activeShape rendering)
  const selectedIndex = selectedDesktopCategory
    ? categoryData.findIndex(c => c.category === selectedDesktopCategory)
    : -1;

  // Render the selected slice larger to make it stand out
  const renderActiveSlice = (props: any) => (
    <g data-category={props.category}>
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={props.innerRadius}
        outerRadius={props.outerRadius + 12}
        startAngle={props.startAngle}
        endAngle={props.endAngle}
        fill={props.fill}
      />
    </g>
  );

  const playgroundBackgroundPattern = 'radial-gradient(circle at center, rgba(124, 58, 237, 0.08) 0, rgba(124, 58, 237, 0.08) 2px, transparent 2px), linear-gradient(rgba(124, 58, 237, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 58, 237, 0.05) 1px, transparent 1px)';
  const playgroundBackgroundSize = '24px 24px, 24px 24px, 24px 24px';
  const lensCenter = playgroundLensState.center;
  const lensPointer = playgroundLensState.pointer;
  const lensBackgroundPosition = `${playgroundLensRadius - lensPointer.x * playgroundLensZoom}px ${playgroundLensRadius - lensPointer.y * playgroundLensZoom}px`;
  const magnifiedBackgroundSizeValue = 24 * playgroundLensZoom;
  const magnifiedBackgroundSize = `${magnifiedBackgroundSizeValue}px ${magnifiedBackgroundSizeValue}px, ${magnifiedBackgroundSizeValue}px ${magnifiedBackgroundSizeValue}px, ${magnifiedBackgroundSizeValue}px ${magnifiedBackgroundSizeValue}px`;
  const lensBackgroundPositionCombined = `${lensBackgroundPosition}, ${lensBackgroundPosition}, ${lensBackgroundPosition}`;

  const renderChartLens = () => {
    if (!chartLensState.isVisible || !chartBoundsRef.current) {
      return null;
    }

    const { width, height } = chartBoundsRef.current;
    if (!width || !height) {
      return null;
    }

    const pointer = chartLensState.pointer;
    const center = chartLensState.center;
    const offsetX = -(pointer.x * chartLensZoom - chartLensSize / 2);
    const offsetY = -(pointer.y * chartLensZoom - chartLensSize / 2);

    return (
      <div
        className="pointer-events-none absolute z-20"
        style={{
          width: `${chartLensSize}px`,
          height: `${chartLensSize}px`,
          left: `${center.x}px`,
          top: `${center.y}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="w-full h-full rounded-full border-2 border-purple-500/80 bg-white/80 dark:bg-gray-900/80 overflow-hidden shadow-lg relative">
          <div
            className="absolute"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transformOrigin: 'top left',
              transform: `translate(${offsetX}px, ${offsetY}px) scale(${chartLensZoom})`,
            }}
          >
            <PieChart width={width} height={height}>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={90}
                innerRadius={0}
                fill="#8884d8"
                dataKey="amount"
                isAnimationActive={false}
              >
                {categoryData.map((entry, index) => {
                  const colors = getCategoryColor(entry.category, 'expense', personalBudget);
                  const isFocused = selectedDesktopCategory === entry.category;
                  const isHovered = hoveredCategory === entry.category;
                  return (
                    <Cell
                      key={`lens-cell-${index}`}
                      fill={colors.hexColor}
                      stroke={isHovered ? '#fff' : (isFocused ? '#312e81' : undefined)}
                      strokeWidth={isHovered ? 4 : (isFocused ? 3 : undefined)}
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </div>
          <div className="absolute inset-0 rounded-full border border-white/50" />
          <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500 border border-white/70" />
        </div>
      </div>
    );
  };

  if (categoryData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Expenses by Category</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">No expense data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      {/* Header: title + selected category name/color */}
      <div className="max-md:hidden flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">Expenses by Category</h2>
        {selectedDesktopCategory && (() => {
          const catColor = getCategoryColor(selectedDesktopCategory, 'expense', personalBudget).hexColor;
          return (
            <>
              <span className="text-gray-300 dark:text-gray-600 font-light">·</span>
              <span className="flex items-center gap-1.5 text-lg font-semibold truncate" style={{ color: catColor }}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                {selectedDesktopCategory}
              </span>
            </>
          );
        })()}
      </div>

      {/* Desktop Layout - Chart slides left when category selected */}
      <div className="max-md:hidden">
        <div className="flex gap-6">
          {/* Chart Container - slides to left when category selected */}
          <motion.div
            ref={chartContainerRef}
            animate={{
              width: selectedDesktopCategory ? '50%' : '100%'
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex-shrink-0 p-8 relative"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'none',
            }}
            onPointerDown={handleChartPointerDown}
            onPointerMove={handleChartPointerMove}
            onPointerUp={handleChartPointerUp}
            onPointerCancel={handleChartPointerUp}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={90}
                  innerRadius={0}
                  fill="#8884d8"
                  dataKey="amount"
                  activeIndex={selectedIndex >= 0 ? selectedIndex : undefined}
                  activeShape={renderActiveSlice}
                >
                  {categoryData.map((entry, index) => {
                    const colors = getCategoryColor(entry.category, 'expense', personalBudget);
                    const isHovered = hoveredCategory === entry.category;
                    const isOtherSelected = !!selectedDesktopCategory && selectedDesktopCategory !== entry.category;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors.hexColor}
                        cursor="pointer"
                        data-category={entry.category}
                        stroke={isHovered ? '#fff' : undefined}
                        strokeWidth={isHovered ? 4 : undefined}
                        opacity={isOtherSelected ? 0.35 : 1}
                      />
                    );
                  })}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: any, _name: any, props: any) => [
                    formatCurrency(value as number),
                    props.payload.category
                  ]}
                  labelFormatter={() => ''}
                  contentStyle={{
                    backgroundColor: '#1f2937', // gray-800
                    border: 'none',
                    borderRadius: '0.5rem',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    color: '#f3f4f6',
                    padding: '8px 12px'
                  }}
                  itemStyle={{
                    color: '#f3f4f6'
                  }}
                  wrapperStyle={{
                    outline: 'none'
                  }}
                  cursor={{ fill: 'transparent' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {renderChartLens()}
          </motion.div>

          {/* Transaction List - appears when category selected */}
          <AnimatePresence>
            {selectedDesktopCategory && (
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex-1 border-l pl-4 pr-2 overflow-y-auto"
              >
                {/* Category budget overview — shown at top of unified panel */}
                {(() => {
                  const spent = categoryData.find(c => c.category === selectedDesktopCategory)?.amount ?? 0;
                  const budget = personalBudget?.categories[selectedDesktopCategory]?.monthlyLimit ?? 0;
                  const catColor = personalBudget?.categories[selectedDesktopCategory]?.color;
                  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500';
                  if (budget === 0) return null;
                  return (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        {catColor && (
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                        )}
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
                          {selectedDesktopCategory}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(spent)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          of {formatCurrency(budget)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-400">{Math.round(pct)}% used</span>
                        <span className="text-xs text-gray-400">
                          {formatCurrency(Math.max(0, budget - spent))} remaining
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Header: title + small X (visible on mobile, hidden on desktop where block-level X is used) */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Transactions
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedDesktopCategory(null);
                      onDeselect?.();
                    }}
                    className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {(() => {
                  const VISIBLE_COUNT = 8;
                  const allCategoryTransactions = transactions
                    .filter(t => t.type === 'expense' && t.category === selectedDesktopCategory)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  const totalTransactions = allCategoryTransactions.length;
                  const categoryTransactions = allCategoryTransactions.slice(0, VISIBLE_COUNT);

                  return (
                    <>
                      <div className="space-y-1.5">
                        {categoryTransactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            onClick={() => onEditTransaction(transaction)}
                          >
                            <div className="flex-1 min-w-0 text-sm text-gray-900 dark:text-gray-100 truncate">
                              {transaction.description}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-3 flex-shrink-0">
                              {formatCurrency(transaction.amount)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {totalTransactions > VISIBLE_COUNT && (
                        <div className="mt-4">
                          <button
                            onClick={() => onViewAllTransactions(selectedDesktopCategory)}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            See All {selectedDesktopCategory} Expenses ({totalTransactions})
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Layout - Pie chart with transaction list */}
      <div className="md:hidden">
        <div
          className="relative"
          style={{
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
          }}
          onPointerDown={handleChartPointerDown}
          onPointerMove={handleChartPointerMove}
          onPointerUp={handleChartPointerUp}
          onPointerCancel={handleChartPointerUp}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={90}
                innerRadius={0}
                fill="#8884d8"
                dataKey="amount"
                activeIndex={focusedCategory
                  ? categoryData.findIndex(c => c.category === focusedCategory.category)
                  : undefined}
                activeShape={renderActiveSlice}
              >
                {categoryData.map((entry, index) => {
                  const colors = getCategoryColor(entry.category, 'expense', personalBudget);
                  const isHovered = hoveredCategory === entry.category;
                  const isOtherFocused = !!focusedCategory && focusedCategory.category !== entry.category;
                  return (
                    <Cell
                      key={`mobile-cell-${index}`}
                      fill={colors.hexColor}
                      cursor="pointer"
                      data-category={entry.category}
                      stroke={isHovered ? '#fff' : undefined}
                      strokeWidth={isHovered ? 4 : undefined}
                      opacity={isOtherFocused ? 0.35 : 1}
                      onClick={() => {
                        handleCategoryClick(entry);
                      }}
                    />
                  );
                })}
              </Pie>
              <RechartsTooltip 
                formatter={(value: any, _name: any, props: any) => [
                  formatCurrency(value as number),
                  props.payload.category
                ]}
                labelFormatter={() => ''}
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '0.5rem',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  color: '#f3f4f6',
                  padding: '8px 12px'
                }}
                itemStyle={{
                  color: '#f3f4f6'
                }}
                wrapperStyle={{
                  outline: 'none'
                }}
                cursor={{ fill: 'transparent' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {renderChartLens()}
        </div>
      
        {/* Mobile-only: Transaction list when category selected */}
        {focusedCategory ? (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {focusedCategory.category}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {focusedCategory.percentage}% of expenses • {formatCurrency(focusedCategory.amount)}
                </p>
              </div>
              <button
                onClick={() => setFocusedCategory(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(() => {
              const categoryTransactions = transactions
                .filter(t => t.type === 'expense' && t.category === focusedCategory.category)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return (
                <>
                  <div className="space-y-2">
                    {categoryTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                        onClick={() => onEditTransaction(transaction)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {transaction.description}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(transaction.date).toLocaleDateString(getUserLocale())}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 ml-3 flex-shrink-0">
                          {formatCurrency(transaction.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {categoryTransactions.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                      No transactions in this category
                    </p>
                  )}

                  <div className="mt-3 text-center">
                    <button
                      onClick={() => setFocusedCategory(null)}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Tap another category or click here to close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400">
            Tap on a category above to see all transactions. Hold to activate the magnifier lens.
          </div>
        )}
      </div>

      {/* Magnifier playground */}
      {showMagnifierPlayground && (
        <div className="mt-8 border border-dashed border-purple-300 rounded-lg bg-purple-50/40 dark:bg-purple-950/20 p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">Magnifier Playground</h3>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              Use this sandbox to prototype the hover lens. Safari-friendly behaviors only.
            </p>
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-300 text-right">
            <div>Active: {playgroundPointerState.isActive ? 'YES' : 'NO'}</div>
            <div>Pointer: {playgroundPointerState.pointerType || '-'}</div>
            <div>Pos: {Math.round(playgroundPointerState.x)}x{Math.round(playgroundPointerState.y)}</div>
            <div>Lens: {playgroundLensState.isVisible ? `${Math.round(lensCenter.x)}x${Math.round(lensCenter.y)}` : '-'}</div>
          </div>
        </div>

        <div
          ref={playgroundRef}
          onPointerDown={handlePlaygroundPointerDown}
          onPointerMove={handlePlaygroundPointerMove}
          onPointerUp={handlePlaygroundPointerUp}
          onPointerCancel={handlePlaygroundPointerUp}
          className="relative h-64 rounded-lg bg-white dark:bg-gray-900 shadow-inner overflow-hidden touch-none select-none"
          style={{
            backgroundImage: playgroundBackgroundPattern,
            backgroundSize: playgroundBackgroundSize,
            backgroundPosition: '0 0, 0 0, 0 0',
          }}
        >
          {playgroundLensState.isVisible ? (
            <>
              <div
                className="absolute rounded-full border-2 border-purple-500/80 bg-white/70 dark:bg-gray-900/70 pointer-events-none shadow-lg"
                style={{
                  width: `${playgroundLensSize}px`,
                  height: `${playgroundLensSize}px`,
                  left: `${lensCenter.x}px`,
                  top: `${lensCenter.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundImage: playgroundBackgroundPattern,
                    backgroundSize: magnifiedBackgroundSize,
                    backgroundPosition: lensBackgroundPositionCombined,
                  }}
                />
                <div className="absolute inset-0 rounded-full border border-white/60" />
                <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500 border border-white/80" />
              </div>
              <div
                className="absolute w-1.5 h-1.5 rounded-full bg-purple-600 pointer-events-none"
                style={{
                  left: `${playgroundLensState.origin.x}px`,
                  top: `${playgroundLensState.origin.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              <span>Long-press or hover to trigger the lens timer</span>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-purple-700 dark:text-purple-300 space-y-1">
          {playgroundLogs.length === 0 ? (
            <div>No pointer activity yet. Try long-pressing or hovering.</div>
          ) : (
            playgroundLogs.map((entry, index) => (
              <div key={index}>{entry}</div>
            ))
          )}
          {playgroundLastSelection && (
            <div className="pt-1 border-t border-purple-300/40 dark:border-purple-700/40 mt-2">
              Last release at {Math.round(playgroundLastSelection.x)}x{Math.round(playgroundLastSelection.y)}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
};
