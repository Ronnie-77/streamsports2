"use client";

/**
 * Fixed, full-viewport animated aurora mesh + subtle grain.
 * Sits behind everything (z-0 / z-1). Pointer-events disabled.
 */
export function SpatialBackground() {
  return (
    <>
      <div className="spatial-aurora" aria-hidden="true" />
      <div className="spatial-grain" aria-hidden="true" />
    </>
  );
}
