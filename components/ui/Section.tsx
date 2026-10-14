"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Container from "./Container";
import Reveal from "./Reveal";

export default function Section({
  children,
  className,
  containerClassName,
  id,
  reveal = true,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
  /** Set false to opt a section out of the default scroll-reveal (e.g. a
   * section that already builds its own staggered entrance per item). */
  reveal?: boolean;
}) {
  const content = reveal ? <Reveal>{children}</Reveal> : children;
  return (
    <section id={id} className={cn("py-16 sm:py-20", className)}>
      <Container className={containerClassName}>{content}</Container>
    </section>
  );
}
