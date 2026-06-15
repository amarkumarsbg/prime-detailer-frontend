/** Shared Tailwind class strings — apply with `max-md:` so desktop layout is unchanged. */

/** Toolbar row: back + title + favourite on mobile */
export const reportMobileTitleRowClass =
  "flex flex-wrap items-center gap-2 max-md:gap-1.5 max-md:w-full";

export const reportMobileBackLinkClass =
  "max-md:px-2 max-md:min-w-9 max-md:[&_svg]:mr-0 max-md:[&_span]:sr-only";

export const reportMobileTitleClass =
  "text-lg font-semibold tracking-tight text-foreground md:text-xl max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-base";

export const reportMobileFavButtonClass =
  "max-md:px-2 max-md:shrink-0 max-md:[&_span]:sr-only";

/** Email / download / print — 3-up grid on phone */
export const reportMobileActionsClass =
  "grid w-full grid-cols-3 gap-2 max-md:gap-1.5 md:flex md:w-auto md:flex-wrap md:items-center lg:justify-end";

export const reportMobileActionButtonClass =
  "max-md:h-9 max-md:flex-col max-md:gap-0.5 max-md:py-1 max-md:text-[10px] max-md:leading-tight";

/** Period + filter selects full width on phone */
export const reportMobileFiltersRowClass =
  "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center max-md:w-full";

export const reportMobileFilterSlotClass =
  "max-md:w-full max-md:[&>*]:w-full max-md:[&_button]:w-full max-md:[&_[data-slot=select-trigger]]:w-full";

/** Report body: edge-to-edge horizontal table scroll on phone */
export const reportMobileContentClass =
  "max-md:space-y-3 max-md:[&_.overflow-x-auto]:-mx-4 max-md:[&_.overflow-x-auto]:px-4 max-md:[&_.overflow-x-auto]:pb-0.5 max-md:[&_table]:text-[11px] max-md:[&_th]:px-1.5 max-md:[&_th]:py-1.5 max-md:[&_td]:px-1.5 max-md:[&_td]:py-1.5";

/** Hub filter pills — horizontal scroll on phone */
export const reportHubFilterScrollClass =
  "max-md:-mx-4 max-md:overflow-x-auto max-md:px-4 max-md:scrollbar-none";

export const reportHubFilterInnerClass = "flex flex-wrap gap-2 max-md:flex-nowrap max-md:pb-0.5";
