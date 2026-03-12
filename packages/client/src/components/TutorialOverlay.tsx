import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'veilfall_tutorial_complete';

interface TutorialStep {
  title: string;
  description: string;
  spotlightSelector: string | null;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome, Heir',
    description:
      'Welcome to Veilfall, Heir. Elder Maren left you this settlement. The walls are thin and the people are few, but the land remembers its strength. Let\u2019s get you started.',
    spotlightSelector: null,
  },
  {
    title: 'Your Resources',
    description:
      'These are your resources. Food, Wood, Stone, Iron, and Aether Stone. Every building, every soldier, every discovery costs something. Watch them carefully \u2014 the land does not give freely.',
    spotlightSelector: '[data-tutorial="resource-bar"]',
  },
  {
    title: 'Build Your First Structure',
    description:
      'Build a Gathering Post to start producing food. Your people need to eat before they can build walls or forge weapons. Click on a building slot to begin construction.',
    spotlightSelector: '[data-tutorial="building-grid"]',
  },
  {
    title: 'Follow the Quest Chain',
    description:
      'The quest chain will guide your first steps. Each task Maren prepared will help you grow stronger. Follow it, and you won\u2019t lose your way.',
    spotlightSelector: '[data-tutorial="quest-tracker"]',
  },
  {
    title: 'Explore the World',
    description:
      'Check the World Map to see what lies beyond your walls. Ruins, resources, rivals \u2014 the Veil hides much, but your scouts will learn to see through it.',
    spotlightSelector: null,
  },
  {
    title: 'The Path Is Yours',
    description:
      'You\u2019re on your own now, Heir. The Elder believed in you. Build wisely, forge alliances, and uncover what the old world left behind. The Veil is thinning.',
    spotlightSelector: null,
  },
];

export default function TutorialOverlay({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const step = STEPS[currentStep];

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Calculate spotlight position when step changes
  useEffect(() => {
    if (!step.spotlightSelector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(step.spotlightSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep, step.spotlightSelector]);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setIsVisible(false);
    setTimeout(onComplete, 300);
  }, [onComplete]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  // Build the spotlight box-shadow mask
  const spotlightStyle = spotlightRect
    ? {
        boxShadow: `
          0 0 0 9999px rgba(8, 14, 30, 0.85),
          0 0 30px 5px rgba(8, 14, 30, 0.6) inset
        `,
        position: 'fixed' as const,
        top: spotlightRect.top - 8,
        left: spotlightRect.left - 8,
        width: spotlightRect.width + 16,
        height: spotlightRect.height + 16,
        borderRadius: '12px',
        border: '1px solid rgba(168, 130, 255, 0.3)',
        pointerEvents: 'none' as const,
        zIndex: 10001,
        transition: 'all 0.4s ease',
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center transition-opacity duration-300"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      {/* Dark overlay (only when no spotlight) */}
      {!spotlightRect && (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(8, 14, 30, 0.85)' }}
        />
      )}

      {/* Spotlight cutout */}
      {spotlightStyle && <div style={spotlightStyle} />}

      {/* Content card */}
      <div
        className="relative z-[10002] max-w-md w-full mx-4 p-6 rounded-xl border border-[var(--aether-violet)]/30"
        style={{
          background: 'linear-gradient(135deg, rgba(26, 39, 68, 0.97), rgba(15, 23, 42, 0.97))',
          boxShadow: '0 0 60px rgba(168, 130, 255, 0.1), 0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Step counter */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-[var(--ruin-grey)] uppercase tracking-widest">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-[10px] text-[var(--ruin-grey)] hover:text-[var(--parchment-dim)] uppercase tracking-wide transition-colors"
          >
            Skip Tutorial
          </button>
        </div>

        {/* Step indicator dots */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === currentStep ? '24px' : '8px',
                background:
                  i === currentStep
                    ? 'var(--aether-violet)'
                    : i < currentStep
                    ? 'var(--aether-violet)'
                    : 'rgba(100, 116, 139, 0.3)',
                opacity: i <= currentStep ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h3
          className="text-lg text-[var(--ember-gold)] mb-3"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-[var(--parchment-dim)] leading-relaxed mb-6 italic">
          "{step.description}"
        </p>

        {/* Attribution */}
        <p className="text-[10px] text-[var(--ember-gold)]/60 mb-5">
          -- Elder Maren's guidance
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentStep > 0
                ? 'text-[var(--parchment-dim)] hover:text-[var(--parchment)] bg-[var(--veil-blue)]/50 border border-[var(--ruin-grey)]/20'
                : 'text-[var(--ruin-grey)]/30 cursor-not-allowed border border-transparent'
            }`}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 rounded-lg text-xs font-medium bg-[var(--aether-violet)]/25 border border-[var(--aether-violet)]/50 text-[var(--parchment)] hover:bg-[var(--aether-violet)]/40 transition-colors"
          >
            {currentStep < STEPS.length - 1 ? 'Next' : 'Begin Your Journey'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Check if the tutorial has already been completed */
export function isTutorialComplete(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
