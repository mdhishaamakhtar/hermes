"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-6 sm:mb-10"
    >
      <div className={action ? "flex items-start justify-between gap-4" : ""}>
        <div className="min-w-0">
          <p className="label mb-1">{label}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted mt-2">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {meta && <div className="mt-3">{meta}</div>}
    </motion.div>
  );
}
