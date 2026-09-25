import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";

export interface Crumb {
  href: string;
  label: string;
}

/** The organiser page column. Skip-to-content lands on it. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-24 sm:px-6 sm:pt-14"
    >
      {children}
    </main>
  );
}

/*
 * Shared by PageHeader and its skeleton, so the placeholder reserves exactly
 * the space the loaded header takes and the page does not jump when data
 * lands. The title box is one line of the title's own type: 1.25em of
 * text-3xl, then of text-4xl from sm up.
 */
const BLOCK = "mb-8 sm:mb-10";
const TITLE_TYPE = "text-3xl sm:text-4xl leading-tight";

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-subtle">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            <Link
              href={crumb.href}
              className="max-w-[16rem] truncate transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
            <Icon name="chevron-right" size={12} className="shrink-0" />
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  crumbs,
  title,
  description,
  meta,
  actions,
}: {
  crumbs?: Crumb[];
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={BLOCK}>
      {crumbs && crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 flex-1 basis-80">
          <h1
            className={`${TITLE_TYPE} font-bold tracking-tight break-words text-foreground`}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-base text-muted">{description}</p>
          )}
          {meta && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-subtle">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/** Loading twin of {@link PageHeader}. */
export function PageHeaderSkeleton({
  crumbs = false,
  description = false,
  action = false,
  titleWidth = "w-56",
}: {
  crumbs?: boolean;
  description?: boolean;
  action?: boolean;
  titleWidth?: string;
}) {
  return (
    <div className={BLOCK}>
      {crumbs && <Skeleton className="mb-3 h-5 w-32" />}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 flex-1 basis-80">
          <Skeleton className={`${TITLE_TYPE} h-[1.25em] ${titleWidth}`} />
          {description && <Skeleton className="mt-2 h-6 w-72 max-w-full" />}
        </div>
        {action && <Skeleton className="h-11 w-36" />}
      </div>
    </div>
  );
}
