"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Children, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 280, damping: 28, mass: 0.85 },
  },
};

function childKey(child: ReactNode, index: number): string | number {
  if (isValidElement(child) && child.key != null) {
    return child.key;
  }
  return index;
}

type StaggerGridProps = {
  className?: string;
  children: ReactNode;
};

export function StaggerGrid({ className, children }: StaggerGridProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {Children.map(children, (child, i) => (
        <motion.div key={childKey(child, i)} variants={staggerItem} className="min-h-0">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
