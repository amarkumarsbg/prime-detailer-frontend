export const easeSmooth = [0.45, 0, 0.55, 1] as [number, number, number, number];

/** KPI / quick-action tiles use CSS hover (see KPICard) so lift isn’t lost when nested under `StaggerGrid`’s `motion.div`. */

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
