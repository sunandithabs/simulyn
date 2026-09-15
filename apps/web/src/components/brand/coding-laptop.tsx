'use client';

import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { Check, CircleAlert, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const CODE = [
  'function twoSum(nums, target) {',
  '  const seen = new Map();',
  '  for (let i = 0; i < nums.length; i++) {',
  '    const need = target - nums[i];',
  '    if (seen.has(need)) return [seen.get(need), i];',
  '    seen.set(nums[i], i);',
  '  }',
  '  return [];',
  '}',
];

export function CodingLaptop({ hero = false }: { hero?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerX = useSpring(useMotionValue(0), { stiffness: 120, damping: 20, mass: 0.7 });
  const pointerY = useSpring(useMotionValue(0), { stiffness: 120, damping: 20, mass: 0.7 });
  const [phase, setPhase] = useState<'typing' | 'error' | 'deleting' | 'accepted'>('typing');
  const [typedCode, setTypedCode] = useState('');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const rotate = useTransform(scrollYProgress, [0.1, 0.48, 0.82], [8, 0, -5]);
  const scrollRotateY = useTransform(scrollYProgress, [0.08, 0.45, 0.86], [hero ? -3 : 8, 0, hero ? 3 : -6]);
  const scrollRotateX = useTransform(scrollYProgress, [0.08, 0.45, 0.86], [hero ? 2 : 5, 0, hero ? -2 : -3]);
  const rotateY = useTransform([scrollRotateY, pointerX], ([scroll, pointer]) => Number(scroll) + Number(pointer) * 4);
  const rotateX = useTransform([scrollRotateX, pointerY], ([scroll, pointer]) => Number(scroll) - Number(pointer) * 3);
  const scale = useTransform(scrollYProgress, [0.1, 0.5, 0.85], [0.84, 1, 0.9]);
  const y = useTransform(scrollYProgress, [0.1, 0.5, 0.85], [80, 0, -55]);
  useEffect(() => {
    let active = true;
    let currentText = '';
    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const type = async (text: string) => {
      for (let index = 0; index < text.length && active; index += 1) {
        currentText = text.slice(0, index + 1);
        setTypedCode(currentText);
        await wait(32);
      }
    };
    const erase = async () => {
      for (let index = currentText.length; index >= 0 && active; index -= 2) {
        currentText = currentText.slice(0, index);
        setTypedCode(currentText);
        await wait(24);
      }
    };
    const loop = async () => {
      const attempt = CODE.slice(0, 3).join('\n');
      const solution = CODE.join('\n');
      while (active) {
        setPhase('typing');
        await type(attempt);
        await wait(800);
        setPhase('error');
        await wait(1500);
        setPhase('deleting');
        await erase();
        await wait(350);
        setPhase('typing');
        await type(solution);
        await wait(500);
        setPhase('accepted');
        await wait(2400);
        currentText = '';
        setTypedCode('');
      }
    };
    void loop();
    return () => { active = false; };
  }, []);

  const renderedCode = hero ? typedCode : CODE.join('\n');

  return (
    <div ref={ref} className={`laptop-story relative mx-auto h-[680px] max-w-6xl ${hero ? 'hero-laptop-story' : ''}`}>
      <div className="sticky top-16 flex h-[calc(100vh-5rem)] min-h-[560px] items-center justify-center">
        <motion.div onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); pointerX.set((event.clientX - rect.left) / rect.width * 2 - 1); pointerY.set((event.clientY - rect.top) / rect.height * 2 - 1); }} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }} style={{ rotate: hero ? 0 : rotate, rotateY, rotateX, scale: hero ? 1.12 : scale, y }} className="relative w-full max-w-[920px] [perspective:1600px] [transform-style:preserve-3d]">
          <div className="laptop-lid overflow-hidden rounded-[20px] border border-white/20 bg-[#171923] p-2 shadow-[0_42px_90px_-30px_rgba(0,0,0,.8)]">
            <div className="relative overflow-hidden rounded-[13px] border border-white/10 bg-[#0b0d13]">
              <div className="flex h-9 items-center gap-2 border-b border-white/10 px-4 font-mono text-[10px] text-[#727b89]">
                <span className="h-2 w-2 rounded-full bg-[#ff6257]" /><span className="h-2 w-2 rounded-full bg-[#ffbd2e]" /><span className="h-2 w-2 rounded-full bg-[#28c840]" />
                <span className="ml-3 truncate">simulyn / algorithms / two-sum.js</span>
                <span className="ml-auto hidden text-[#4ade80] sm:inline">● LIVE SESSION</span>
              </div>
              <div className="grid min-h-[380px] grid-cols-[1fr_0.62fr]">
                <div className="border-r border-white/10 bg-[#0e1017] p-5 font-mono text-[11px] leading-[1.95] text-[#9da7b5] sm:p-7 sm:text-[13px]">
                  <div className="mb-5 flex items-center gap-3 text-[10px] uppercase tracking-[.18em] text-[#566071]"><span>main.js</span><span className="text-[#c6a15b]">unsaved</span></div>
                  {renderedCode.split('\n').map((line, index) => (
                    <div key={line} className="flex"><span className="mr-5 w-4 select-none text-right text-[#3f4653]">{index + 1}</span><span className={index === 5 ? 'text-[#d37d89]' : index === 1 || index === 3 ? 'text-[#b2a0d8]' : 'text-[#9da7b5'}>{line}</span></div>
                  ))}
                  {phase === 'error' || phase === 'deleting' ? <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[#d37d89]"><CircleAlert className="h-3.5 w-3.5" /> TypeError: seen is not defined</div> : null}
                  {phase === 'typing' ? <span className="code-caret" /> : null}
                </div>
                <div className="bg-[#11141b] p-5 font-mono text-[11px] sm:p-7 sm:text-[12px]">
                  <div className="mb-5 flex items-center justify-between text-[10px] uppercase tracking-[.18em] text-[#566071]"><span>problem 01</span><span className="text-[#c6a15b]">medium</span></div>
                  <h3 className="font-sans text-base font-medium tracking-tight text-[#e9e7df]">Two Sum</h3>
                  <p className="mt-3 font-sans text-[12px] leading-relaxed text-[#838b98]">Return indices of two numbers that add up to target.</p>
                  <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-[#6d7683]"><div><span className="text-[#c6a15b]">input</span> [2, 7, 11, 15], 9</div><div><span className="text-[#4ade80]">output</span> [0, 1]</div></div>
                  <div className="mt-8 flex items-center gap-2"><button className="flex items-center gap-2 rounded-md bg-[#ded8c7] px-3 py-2 font-sans text-[11px] font-semibold text-[#16171c]"><Play className="h-3 w-3 fill-current" /> Run tests</button><button className="rounded-md border border-white/10 p-2 text-[#6d7683]"><RotateCcw className="h-3 w-3" /></button></div>
                  <motion.div animate={{ opacity: phase === 'accepted' ? 1 : 0.18 }} className="mt-7 border-t border-[#4ade80]/25 pt-4 text-[#4ade80]"><div className="flex items-center gap-2"><Check className="h-4 w-4" /> {phase === 'accepted' ? 'Accepted' : 'Waiting for tests'}</div><div className="mt-2 text-[10px] text-[#6d9f7c]">{phase === 'accepted' ? '4 / 4 test cases passed · 62 ms' : 'run tests to validate'}</div></motion.div>
                </div>
              </div>
            </div>
          </div>
          <div className="laptop-base mx-auto h-5 w-[106%] -translate-x-[3%] rounded-b-[24px] border border-white/10 bg-[#2a2c35] shadow-[0_28px_45px_-20px_rgba(0,0,0,.9)]"><div className="mx-auto h-1.5 w-24 rounded-b-full bg-[#444753]" /></div>
          <div className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(198,161,91,.13),transparent_60%)] blur-3xl" />
        </motion.div>
      </div>
    </div>
  );
}
