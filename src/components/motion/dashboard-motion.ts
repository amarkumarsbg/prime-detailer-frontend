export const easeSmooth = [0.45, 0, 0.55, 1] as [number, number, number, number];

/** Clickable KPI tiles use CSS hover lift; static KPI tiles stay `cursor-default` (see KPICard). */

export const alertStaggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const alertStaggerItem = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 32 },
  },
};
