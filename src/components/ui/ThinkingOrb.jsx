/**
 * ThinkingOrb — Orbs-style animated dots indicator.
 * Re-implemented locally with CSS + existing Framer Motion.
 * Use for: ScannerModal busy state, EmptyState with loading prop.
 * All styles live in App.css .dp-thinking-orb / .dp-orb-dot classes.
 */

/**
 * @param {object} props
 * @param {string} [props.label='Processing...'] - Screen reader label
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Visual size
 */
export function ThinkingOrb({ label = 'Processing...', size = 'md' }) {
  const dotSize = size === 'sm' ? '6px' : size === 'lg' ? '11px' : '8px'
  const gap = size === 'sm' ? '0.35rem' : size === 'lg' ? '0.6rem' : '0.45rem'

  return (
    <div
      className="dp-thinking-orb"
      style={{ gap }}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <div className="dp-orb-dot" style={{ width: dotSize, height: dotSize }} aria-hidden="true" />
      <div className="dp-orb-dot" style={{ width: dotSize, height: dotSize }} aria-hidden="true" />
      <div className="dp-orb-dot" style={{ width: dotSize, height: dotSize }} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default ThinkingOrb
