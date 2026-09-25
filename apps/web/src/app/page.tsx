'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Circle, Cpu, ShieldCheck, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

import { CodingLaptop } from '@/components/brand/coding-laptop';
import { SignalTrace } from '@/components/brand/signal-trace';
import { Button } from '@/components/ui/button';

const reveal = {
  hidden: { opacity: 0, y: 42 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const CAPABILITIES = [
  { no: '01', icon: TerminalSquare, title: 'Real compilers', copy: 'Python, JavaScript, C++ and Java in one sandbox.' },
  { no: '02', icon: Cpu, title: 'Circuit labs', copy: 'Inputs, tolerance and consequence on one bench.' },
  { no: '03', icon: ShieldCheck, title: 'Clear assessment', copy: 'Useful signals for instructors and students.' },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main className="simulyn-landing overflow-hidden">
      <header className="site-nav"><Link href="/" className="wordmark">SIMULYN<span>®</span></Link><nav className="flex items-center gap-5 md:gap-8"><a href="#system">System</a><a href="#signal">Signal</a></nav></header>

      <section ref={heroRef} className="hero-section hero-section-laptop relative">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="hero-content hero-content-laptop"><h1>Learn by<br /><em>solving.</em></h1><p className="hero-copy">A focused workspace for code, circuits and assessment.</p><div className="hero-actions"><Link href="/login"><Button size="lg" className="hero-cta">Enter the workspace <ArrowRight className="h-4 w-4" /></Button></Link></div></motion.div>
        <div className="hero-laptop-wrap"><CodingLaptop hero /></div>
      </section>

      <motion.section id="system" className="capabilities-section section-pad" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}><motion.div variants={reveal} className="section-kicker">THE SYSTEM <span>01</span></motion.div><div className="capabilities-head"><motion.h2 variants={reveal}>Make the<br /><span>attempt visible.</span></motion.h2><motion.div variants={reveal}><p>One connected workspace for programming, electronics and assessment.</p><p className="muted-copy mt-3">Compile. Test. Adjust. Repeat.</p><div className="why-simulyn"><span>WHY SIMULYN OVER LEETCODE?</span><strong>Because the work does not stop at a solved problem.</strong><small>Simulyn connects code, circuits, assessment and teaching feedback in one loop.</small></div></motion.div></div><motion.div variants={stagger} className="capability-list">{CAPABILITIES.map(({ no, icon: Icon, title, copy }) => <motion.div variants={reveal} key={no}><Link href="/login" className="capability-row"><span className="cap-no">{no}</span><Icon className="cap-icon" /><span className="cap-title">{title}</span><span className="cap-copy">{copy}</span><ArrowRight className="cap-arrow" /></Link></motion.div>)}</motion.div></motion.section>

      <motion.section id="signal" className="signal-section section-pad" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}><motion.div variants={reveal} className="section-kicker">SIGNAL <span>02</span></motion.div><div className="signal-grid"><motion.div variants={reveal}><h2>See the<br /><span>work clearly.</span></h2><p>Activity, accuracy and progress in one cool, calm, collected view.</p></motion.div><motion.div variants={reveal} className="signal-panel"><div className="instrument-top"><span>SIMULYN / ACTIVITY</span><span>SAMPLE DATA</span></div><SignalTrace className="signal-trace" /><div className="instrument-readout"><span>13 WEEKS</span><strong>+ 032 SOLVES · 67% FLOW</strong><span>STREAK 07</span></div></motion.div></div></motion.section>

      <section className="final-section section-pad"><div className="final-mark"><Circle className="h-3 w-3 fill-current" /> READY WHEN YOU ARE</div><h2>Make the next<br /><em>attempt</em> count.</h2></section>
      <footer className="site-footer"><span className="wordmark">SIMULYN<span>®</span></span><span>Virtual engineering labs / 2026</span><span>Build the instinct.</span></footer>
    </main>
  );
}
