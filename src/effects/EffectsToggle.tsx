import { Sparkle, Sparkles } from 'lucide-react';
import { useEffects } from './useEffects';

/** Lets players turn motion down regardless of their OS setting. */
export function EffectsToggle({ className }: { className?: string }) {
  const { level, setLevel } = useEffects();
  const full = level === 'full';
  const Icon = full ? Sparkles : Sparkle;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={full}
      onClick={() => setLevel(full ? 'reduced' : 'full')}
    >
      <Icon className="btn-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="btn-label">Effects: {full ? 'On' : 'Reduced'}</span>
    </button>
  );
}
