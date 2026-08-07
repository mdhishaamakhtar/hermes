import { type ReactNode } from "react";
import { Shimmer } from "@/components/ui/Shimmer";

/*
 * Geometry shared by PageHeader and PageHeaderSkeleton.
 *
 * These constants and the skeleton below exist in this file on purpose. The
 * skeleton previously hand-copied these spacings from across the codebase,
 * and they silently fell out of step — the post-load jump fixed in 032341d
 * was a 10px height mismatch introduced exactly that way. Keeping both in one
 * module means you cannot restyle the header without seeing its placeholder.
 */
const BLOCK = "mb-6 sm:mb-10";
const TITLE_TEXT = "text-2xl md:text-3xl";
const TITLE_LEADING = "leading-tight";
/**
 * The title placeholder carries the real title's font-size classes and a
 * height of one `leading-tight` line box (1.25em). Because `em` resolves
 * against the element's own font-size, this tracks the responsive step from
 * text-2xl to text-3xl automatically — 30px then 37.5px — where the previous
 * `h-8 md:h-9` guess was 2px short at desktop and shifted the page on load.
 */
const TITLE_BOX = `${TITLE_TEXT} h-[1.25em]`;
const LABEL_GAP = "mb-1";
const DESCRIPTION_GAP = "mt-2";

interface PageHeaderProps {
  label: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
}

export default function PageHeader({
  label,
  title,
  description,
  meta,
  action,
}: PageHeaderProps) {
  return (
    <div className={BLOCK}>
      <div className={action ? "flex items-start justify-between gap-4" : ""}>
        <div className="min-w-0">
          <p className={`label ${LABEL_GAP}`}>{label}</p>
          <h1
            className={`${TITLE_TEXT} ${TITLE_LEADING} font-bold text-foreground`}
          >
            {title}
          </h1>
          {description && (
            <p className={`text-sm text-muted ${DESCRIPTION_GAP}`}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {meta && <div className="mt-3">{meta}</div>}
    </div>
  );
}

interface PageHeaderSkeletonProps {
  /** Width of the title placeholder — vary it so pages don't all look alike. */
  titleWidth?: string;
  labelWidth?: string;
  description?: boolean;
  action?: boolean;
}

/** Loading twin of {@link PageHeader}. Same spacings, by construction. */
export function PageHeaderSkeleton({
  titleWidth = "w-48",
  labelWidth = "w-16",
  description = false,
  action = false,
}: PageHeaderSkeletonProps) {
  return (
    <div className={BLOCK}>
      <div className={action ? "flex items-start justify-between gap-4" : ""}>
        <div className="min-w-0">
          <Shimmer h="h-4" w={labelWidth} tone="soft" className={LABEL_GAP} />
          <Shimmer h={TITLE_BOX} w={titleWidth} />
          {description && (
            <Shimmer h="h-5" w="w-40" tone="soft" className={DESCRIPTION_GAP} />
          )}
        </div>
        {action && (
          <div className="shrink-0 pt-1">
            <Shimmer h="h-10" w="w-28" />
          </div>
        )}
      </div>
    </div>
  );
}
