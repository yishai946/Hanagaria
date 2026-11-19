import { Suspense, useEffect, useState } from 'react';
import { DEMO_PLAN } from '@shared/demoPlan';
import { normalizePlan } from '@shared/plan';
import { Viewer3D } from '../three/LazyViewer';

/* Decorative 3D model behind home / generating screens (the demo project). */
const DEMO_NORMALIZED = normalizePlan(DEMO_PLAN);

export function BgModel({ cycle }: { cycle?: boolean }) {
  const last = DEMO_NORMALIZED.steps.length - 1;
  const [step, setStep] = useState(cycle ? 0 : last);
  useEffect(() => {
    if (!cycle) return;
    const t = setInterval(() => setStep((s) => (s >= last ? 0 : s + 1)), 2400);
    return () => clearInterval(t);
  }, [cycle, last]);
  return (
    <Suspense fallback={null}>
      <Viewer3D plan={DEMO_NORMALIZED} step={step} explode={cycle ? 0 : 0.2} ghost={false} autoRotate replay={0} selected={null} onSelect={() => {}} />
    </Suspense>
  );
}
