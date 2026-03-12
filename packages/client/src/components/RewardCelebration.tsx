import { useState, useEffect, useCallback, useMemo } from 'react';

interface RewardCelebrationProps {
  title: string;
  subtitle?: string;
  rewards: Record<string, number>;
  onClose: () => void;
}

const RESOURCE_ICONS: Record<string, string> = {
  food: '\u{1F33E}',
  wood: '\u{1FAB5}',
  stone: '\u{1FAA8}',
  iron: '\u2699\uFE0F',
  aether_stone: '\u{1F48E}',
  xp: '\u2728',
};

const RESOURCE_LABELS: Record<string, string> = {
  food: 'Food',
  wood: 'Wood',
  stone: 'Stone',
  iron: 'Iron',
  aether_stone: 'Aether Stone',
  xp: 'Experience',
};

const AUTO_CLOSE_MS = 5000;
const ITEM_STAGGER_MS = 100;
const MODAL_ENTER_MS = 300;

/**
 * Inline keyframes injected once into the document head.
 * Using a style element avoids any dependency on tailwind config extensions.
 */
const KEYFRAMES = `
@keyframes rc-scale-in {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes rc-fade-up {
  0% { transform: translateY(12px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes rc-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes rc-glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(212,168,67,0.25); }
  50% { box-shadow: 0 0 18px rgba(212,168,67,0.55); }
}
@keyframes rc-border-glow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@keyframes rc-sparkle {
  0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

export default function RewardCelebration({
  title,
  subtitle,
  rewards,
  onClose,
}: RewardCelebrationProps) {
  const [stage, setStage] = useState<'entering' | 'items' | 'complete'>('entering');
  const [visibleItems, setVisibleItems] = useState(0);
  const [closing, setClosing] = useState(false);

  const rewardEntries = useMemo(
    () => Object.entries(rewards).filter(([, amount]) => amount !== 0),
    [rewards],
  );

  // Inject keyframes on first mount
  useEffect(() => {
    injectStyles();
  }, []);

  // Animation sequencing: entering -> items -> complete
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // After modal entrance, begin staggering items
    timers.push(
      setTimeout(() => {
        setStage('items');
      }, MODAL_ENTER_MS),
    );

    // Stagger each reward item
    for (let i = 0; i < rewardEntries.length; i++) {
      timers.push(
        setTimeout(() => {
          setVisibleItems((prev) => prev + 1);
        }, MODAL_ENTER_MS + ITEM_STAGGER_MS * (i + 1)),
      );
    }

    // Mark complete after all items are shown
    const totalItemsDelay =
      MODAL_ENTER_MS + ITEM_STAGGER_MS * (rewardEntries.length + 1);
    timers.push(
      setTimeout(() => {
        setStage('complete');
      }, totalItemsDelay),
    );

    return () => timers.forEach(clearTimeout);
  }, [rewardEntries.length]);

  // Auto-close timer
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 250);
  }, [closing, onClose]);

  // Keyboard support: Escape to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  const formatAmount = (amount: number): string => {
    if (amount >= 1_000_000) return `+${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `+${(amount / 1_000).toFixed(1)}K`;
    return `+${amount.toLocaleString()}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.25s ease',
      }}
      onClick={handleClose}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-sm rounded-xl overflow-hidden"
        style={{
          animation: `rc-scale-in ${MODAL_ENTER_MS}ms ease-out forwards`,
          background: 'var(--veil-blue)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated gradient border glow */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            padding: '2px',
            background:
              'linear-gradient(135deg, var(--ember-gold), var(--aether-violet), var(--ember-gold))',
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            animation: 'rc-border-glow 2s ease-in-out infinite',
          }}
        />

        {/* Decorative sparkles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { top: '8%', left: '12%', delay: '0s', size: '10px' },
            { top: '15%', right: '18%', delay: '0.6s', size: '8px' },
            { top: '30%', left: '8%', delay: '1.2s', size: '6px' },
            { top: '55%', right: '10%', delay: '0.3s', size: '9px' },
            { top: '75%', left: '20%', delay: '0.9s', size: '7px' },
          ].map((spark, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                ...spark,
                width: spark.size,
                height: spark.size,
                color: 'var(--ember-gold)',
                fontSize: spark.size,
                animation: `rc-sparkle 2s ease-in-out infinite`,
                animationDelay: spark.delay,
              }}
            >
              {'\u2726'}
            </span>
          ))}
        </div>

        <div className="relative z-10 p-6 flex flex-col items-center gap-5">
          {/* Header */}
          <div className="text-center">
            <h2
              className="text-2xl font-bold tracking-wide"
              style={{
                fontFamily: 'Cinzel, serif',
                background:
                  'linear-gradient(90deg, var(--ember-gold), #f5e6b8, var(--ember-gold))',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'rc-shimmer 3s linear infinite',
                filter: 'drop-shadow(0 0 12px rgba(212,168,67,0.4))',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                className="text-sm mt-1.5 tracking-wider uppercase"
                style={{ color: 'var(--parchment-dim)' }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Divider */}
          <div
            className="w-3/4 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--ember-gold), transparent)',
            }}
          />

          {/* Reward items grid */}
          <div
            className="w-full grid gap-3"
            style={{
              gridTemplateColumns:
                rewardEntries.length <= 2
                  ? 'repeat(auto-fit, minmax(140px, 1fr))'
                  : 'repeat(auto-fit, minmax(120px, 1fr))',
            }}
          >
            {rewardEntries.map(([resource, amount], index) => {
              const isVisible = index < visibleItems;
              const icon = RESOURCE_ICONS[resource] ?? '\u{1F381}';
              const label =
                RESOURCE_LABELS[resource] ??
                resource.charAt(0).toUpperCase() +
                  resource.slice(1).replace(/_/g, ' ');

              return (
                <div
                  key={resource}
                  className="flex flex-col items-center gap-1 rounded-lg p-3"
                  style={{
                    background: 'rgba(10,14,26,0.6)',
                    border: '1px solid rgba(212,168,67,0.15)',
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                    animation: isVisible
                      ? 'rc-glow-pulse 2.5s ease-in-out infinite'
                      : 'none',
                    animationDelay: `${index * 0.15}s`,
                  }}
                >
                  <span
                    className="text-3xl leading-none"
                    role="img"
                    aria-label={label}
                  >
                    {icon}
                  </span>
                  <span
                    className="text-xs uppercase tracking-wider"
                    style={{ color: 'var(--parchment-dim)' }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{
                      fontFamily: 'Cinzel, serif',
                      color: 'var(--ember-gold)',
                      textShadow: '0 0 10px rgba(212,168,67,0.5)',
                    }}
                  >
                    {formatAmount(amount)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Continue button - appears after all items shown */}
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-lg font-semibold tracking-wider uppercase text-sm transition-all duration-200 cursor-pointer"
            style={{
              fontFamily: 'Cinzel, serif',
              background:
                'linear-gradient(135deg, var(--ember-gold), #b8862a)',
              color: 'var(--veil-blue-deep)',
              opacity: stage === 'complete' ? 1 : 0,
              transform:
                stage === 'complete' ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              pointerEvents: stage === 'complete' ? 'auto' : 'none',
              boxShadow: '0 0 20px rgba(212,168,67,0.3)',
            }}
            aria-label="Close reward celebration"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
