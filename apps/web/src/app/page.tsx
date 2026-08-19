'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Cpu, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react';
import Link from 'next/link';

import { SignalTrace } from '@/components/brand/signal-trace';
import { ThemeSwitcher } from '@/components/brand/theme-switcher';
import { Button } from '@/components/ui/button';

const CAPABILITIES = [
  { icon: TerminalSquare, label: 'Python & C++ labs', detail: 'Four languages, real compilers' },
  { icon: Cpu, label: 'Circuit simulation', detail: 'Tolerance-checked answers' },
  { icon: Sparkles, label: 'AI mentor', detail: 'Hints, never solutions' },
  { icon: ShieldCheck, label: 'Live proctoring', detail: 'Integrity scored in real time' },
];

// Reads as instrument channels: each row is a real measurement the platform takes.
const READINGS = [
  { value: '4', unit: 'languages', note: 'python · js · c++ · java' },
  { value: '8s', unit: 'wall clock', note: 'per test case' },
  { value: '20', unit: 'concurrent', note: 'sandboxed executions' },
  { value: '14', unit: 'signals', note: 'proctoring violation types' },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="orb-field">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-baseline gap-2.5">
          <span className="brand-mark text-lg font-semibold tracking-[-0.03em]">SIMULYN</span>
          <span className="instrument hidden sm:inline">virtual engineering labs</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-10 pb-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="instrument">Bench 01 · online</span>
          <h1 className="font-display mt-4 text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-white">
            The lab bench,
            <br />
            <span className="brand-mark">without the lab.</span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
            Write code against real compilers, measure circuits that behave like the ones on the
            bench, and sit exams your instructor can watch in real time. One workspace for the
            whole semester.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login">
              <Button size="lg" className="group">
                Enter workspace
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <span className="font-mono text-[11px] text-faint">
              Demo accounts on the sign-in screen
            </span>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {READINGS.map((reading, i) => (
              <motion.li
                key={reading.unit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + i * 0.07 }}
              >
                <div className="hairline w-8" />
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-paper tabular">
                  {reading.value}
                </div>
                <div className="instrument mt-0.5">{reading.unit}</div>
                <div className="mt-1 font-mono text-[10px] text-faint">{reading.note}</div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Signature: the live trace, bleeding past the container on wide screens. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative"
        >
          <div className="glass relative overflow-hidden lg:-mr-24">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="instrument">ch1 · mixed signal</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-trace">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-trace" />
                ACQUIRING
              </span>
            </div>
            <SignalTrace className="block h-[280px] w-full sm:h-[340px]" />
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
              <span className="font-mono text-[10px] text-faint">2.00 V/div</span>
              <span className="font-mono text-[10px] text-faint">500 µs/div</span>
              <span className="font-mono text-[10px] text-brass">TRIG ↑</span>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((capability, i) => (
            <motion.div
              key={capability.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.06 }}
              className="glass glass-lift p-4"
            >
              <capability.icon className="h-5 w-5 text-violet-lit" strokeWidth={1.5} />
              <div className="mt-3 text-sm font-medium text-paper">{capability.label}</div>
              <div className="mt-1 font-mono text-[11px] text-faint">{capability.detail}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="brand-mark font-mono text-[11px]">SIMULYN</span>
          <span className="font-mono text-[11px] text-faint">Engineering education platform</span>
        </div>
      </footer>
    </main>
  );
}
