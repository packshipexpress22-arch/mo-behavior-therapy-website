import type { ReactNode } from "react";
import Container from "./Container";

export default function PageHero({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <section className="wave-divider border-b border-ink-100">
      <Container className="py-14 sm:py-20">
        <h1 className="max-w-3xl font-display text-4xl font-bold text-ink-900 sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-700">{intro}</p>}
        {children}
      </Container>
    </section>
  );
}
