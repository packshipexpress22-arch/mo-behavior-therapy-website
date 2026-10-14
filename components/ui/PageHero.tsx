"use client";

import type { ReactNode } from "react";
import Container from "./Container";
import FloatingShapes from "./FloatingShapes";
import Reveal from "./Reveal";

export default function PageHero({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden wave-divider border-b border-ink-100">
      <FloatingShapes variant="warm" />
      <Container className="relative py-14 sm:py-20">
        <Reveal>
          <h1 className="max-w-3xl font-display text-4xl font-bold text-ink-900 sm:text-5xl">{title}</h1>
          {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-700">{intro}</p>}
          {children}
        </Reveal>
      </Container>
    </section>
  );
}
