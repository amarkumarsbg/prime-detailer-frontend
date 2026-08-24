"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 max-w-full flex-nowrap items-center justify-start overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1 text-muted-foreground scrollbar-none [-webkit-overflow-scrolling:touch]",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

function scrollTabIntoListView(el: HTMLElement) {
  const list = el.parentElement;
  if (!list) return;
  const listRect = list.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const pad = 8;
  let nextLeft = list.scrollLeft;
  if (elRect.left < listRect.left + pad) {
    nextLeft -= listRect.left + pad - elRect.left;
  } else if (elRect.right > listRect.right - pad) {
    nextLeft += elRect.right - (listRect.right - pad);
  } else {
    return;
  }
  list.scrollTo({ left: Math.max(0, nextLeft), behavior: "smooth" });
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const innerRef = React.useRef<HTMLButtonElement | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const sync = () => {
      if (el.getAttribute("data-state") === "active") {
        // Defer so layout/active styles are applied before measuring.
        requestAnimationFrame(() => scrollTabIntoListView(el));
      }
    };

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["data-state"] });
    return () => obs.disconnect();
  }, []);

  return (
    <TabsPrimitive.Trigger
      ref={setRefs}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
