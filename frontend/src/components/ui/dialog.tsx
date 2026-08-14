"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/** Bottom-sheet positioning for custom p-0 dialog layouts (forms, wizards). */
export const dialogMobileSheetContentClasses =
  "flex w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg";

/** Shared header spacing for mobile bottom-sheet forms. */
export const dialogMobileSheetHeaderClasses =
  "shrink-0 space-y-1 border-b border-border/60 px-6 pb-4 pt-4 text-left max-sm:pt-5";

type DialogMobileVariant = "sheet" | "centered" | "fullscreen";

/** Mobile bottom sheet chrome (keyboard bottom/max-h applied after consumer className). */
const dialogMobileSheetClasses =
  "max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:left-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]";

const dialogMobileFullscreenClasses =
  "max-sm:fixed max-sm:inset-x-0 max-sm:left-0 max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:pb-[env(safe-area-inset-bottom)]";

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
    /** Mobile presentation: bottom sheet (default), centered modal, or full screen. */
    mobileVariant?: DialogMobileVariant;
    /** Drag handle on mobile bottom sheets (default: true for sheet variant). */
    showMobileHandle?: boolean;
  }
>(
  (
    {
      className,
      children,
      showClose = true,
      mobileVariant = "sheet",
      showMobileHandle,
      ...props
    },
    ref
  ) => {
    const isSheet = mobileVariant === "sheet";
    const showHandle = showMobileHandle ?? isSheet;

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            isSheet && [
              dialogMobileSheetClasses,
              "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
            ],
            mobileVariant === "fullscreen" && [
              dialogMobileFullscreenClasses,
              "max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom",
            ],
            mobileVariant === "centered" && [
              "max-sm:rounded-lg",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
              "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            ],
            mobileVariant !== "centered" && [
              "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
              "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
              "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
            ],
            "sm:rounded-lg",
            className,
            // After consumer className so keyboard-aware bottom/max-h win over plain max-h overrides on mobile
            isSheet &&
              "max-sm:bottom-[var(--vv-keyboard-inset,0px)] max-sm:max-h-[min(92dvh,var(--vv-height,100dvh))]",
            mobileVariant === "fullscreen" &&
              "max-sm:bottom-[var(--vv-keyboard-inset,0px)] max-sm:top-[var(--vv-offset-top,0px)] max-sm:h-[var(--vv-height,100dvh)] max-sm:max-h-[var(--vv-height,100dvh)]"
          )}
          {...props}
        >
          {showHandle ? (
            <div
              className="flex shrink-0 items-center justify-center pb-2 pt-3 sm:hidden"
              aria-hidden
            >
              <div className="h-1 w-10 rounded-full bg-border/80" />
            </div>
          ) : null}
          {children}
          {showClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 max-sm:top-5 rounded-sm opacity-70 ring-offset-background transition-opacity cursor-pointer hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-left max-sm:pt-2 sm:pt-0",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2",
      "[&_button]:w-full sm:[&_button]:w-auto",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("pr-8 text-lg font-semibold leading-snug tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
