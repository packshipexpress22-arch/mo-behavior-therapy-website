import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Container from "./Container";

export default function Section({
  children,
  className,
  containerClassName,
  id,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 sm:py-20", className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
