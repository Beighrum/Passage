import React, { useCallback, useMemo, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

import { cn } from "@/lib/utils";
import { useDimensions } from "@/hooks/use-debounced-dimensions";

interface PixelTrailProps {
  pixelSize: number; // px
  fadeDuration?: number; // ms
  delay?: number; // ms
  className?: string;
  pixelClassName?: string;
  colors?: string[];
}

const DEFAULT_PURPLES = [
  "#7B4F9E", // Passage-ish purple already used in app
  "#8E5BB8",
  "#6E3C96",
  "#AA7BD1",
  "#4A2D6B",
];

const PixelTrail: React.FC<PixelTrailProps> = ({
  pixelSize = 20,
  fadeDuration = 500,
  delay = 0,
  className,
  pixelClassName,
  colors = DEFAULT_PURPLES,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(containerRef);
  const trailId = useRef(uuidv4());

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / pixelSize);
      const y = Math.floor((e.clientY - rect.top) / pixelSize);

      const pixelElement = document.getElementById(`${trailId.current}-pixel-${x}-${y}`);
      if (pixelElement) {
        const animatePixel = (pixelElement as any).__animatePixel as
          | ((clientX: number, clientY: number) => void)
          | undefined;
        if (animatePixel) animatePixel(e.clientX, e.clientY);
      }
    },
    [pixelSize],
  );

  const columns = useMemo(
    () => Math.max(1, Math.ceil(dimensions.width / pixelSize)),
    [dimensions.width, pixelSize],
  );
  const rows = useMemo(
    () => Math.max(1, Math.ceil(dimensions.height / pixelSize)),
    [dimensions.height, pixelSize],
  );

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 w-full h-full pointer-events-auto", className)}
      onMouseMove={handleMouseMove}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <PixelDot
              key={`${colIndex}-${rowIndex}`}
              id={`${trailId.current}-pixel-${colIndex}-${rowIndex}`}
              size={pixelSize}
              fadeDuration={fadeDuration}
              delay={delay}
              className={pixelClassName}
              colors={colors}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface PixelDotProps {
  id: string;
  size: number;
  fadeDuration: number;
  delay: number;
  className?: string;
  colors: string[];
}

const PixelDot: React.FC<PixelDotProps> = React.memo(
  ({ id, size, fadeDuration, delay, className, colors }) => {
    const controls = useAnimationControls();

    const animatePixel = useCallback(() => {
      const c = colors[Math.floor(Math.random() * colors.length)] ?? "#7B4F9E";
      controls.start({
        opacity: [1, 0],
        transition: { duration: fadeDuration / 1000, delay: delay / 1000 },
      });
      const el = document.getElementById(id) as HTMLDivElement | null;
      if (el) el.style.backgroundColor = c;
    }, [colors, controls, delay, fadeDuration, id]);

    const ref = useCallback(
      (node: HTMLDivElement | null) => {
        if (node) {
          (node as any).__animatePixel = animatePixel;
        }
      },
      [animatePixel],
    );

    return (
      <motion.div
        id={id}
        ref={ref}
        className={cn("pointer-events-none", className)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: 2,
          backgroundColor: "transparent",
        }}
        initial={{ opacity: 0 }}
        animate={controls}
        exit={{ opacity: 0 }}
      />
    );
  },
);

PixelDot.displayName = "PixelDot";
export { PixelTrail };

