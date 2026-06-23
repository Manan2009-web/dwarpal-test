import { motion, useReducedMotion } from 'framer-motion'

export default function AuthPage({ left, right }) {
  const reduceMotion = useReducedMotion()

  // If no left panel is provided, center the right panel (LoginForm) in the dead center of the screen
  if (!left) {
    return (
      <div
        className="tw:relative tw:isolate tw:min-h-screen tw:w-full tw:flex tw:items-center tw:justify-center tw:bg-dwarpal-surface tw:font-sans tw:text-dwarpal-ink tw:overflow-hidden"
        style={{
          backgroundImage: `
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.95) 0, rgba(255, 255, 255, 0.42) 24%, transparent 46%),
            radial-gradient(circle at top right, rgba(184, 226, 255, 0.52) 0, transparent 34%),
            radial-gradient(circle at bottom left, rgba(205, 236, 255, 0.5) 0, transparent 28%),
            linear-gradient(180deg, #f6fbff 0%, #edf6ff 52%, #e6f1ff 100%)
          `,
        }}
      >
        {/* Glowing Orbs */}
        <motion.div
          aria-hidden="true"
          className="tw:absolute tw:-left-20 tw:top-12 tw:h-64 tw:w-64 tw:rounded-full tw:bg-[rgba(171,221,255,0.38)] tw:blur-3xl tw:pointer-events-none"
          animate={reduceMotion ? undefined : { x: [0, 22, 0], y: [0, -18, 0] }}
          transition={reduceMotion ? undefined : { duration: 13, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          aria-hidden="true"
          className="tw:absolute tw:right-[-5rem] tw:top-[-3rem] tw:h-72 tw:w-72 tw:rounded-full tw:bg-[rgba(129,183,255,0.2)] tw:blur-3xl tw:pointer-events-none"
          animate={reduceMotion ? undefined : { x: [0, -28, 0], y: [0, 18, 0] }}
          transition={reduceMotion ? undefined : { duration: 15, ease: 'easeInOut', repeat: Infinity }}
        />

        {/* Grid Line Overlays */}
        <div
          aria-hidden="true"
          className="tw:absolute tw:inset-0 tw:opacity-40 tw:pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(122, 154, 194, 0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(122, 154, 194, 0.08) 1px, transparent 1px)
            `,
            backgroundPosition: 'center center',
            backgroundSize: '140px 140px',
            maskImage: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6), transparent)',
          }}
        />

        {/* Center alignment container (Dead Center Centering) */}
        <div className="tw:relative tw:z-10 tw:w-full tw:max-w-[31rem] tw:px-4 tw:py-8 tw:flex tw:items-center tw:justify-center">
          {right}
        </div>
      </div>
    )
  }

  // Dual-panel (split screen) mode for AccessPortalScreen
  return (
    <div
      className="tw:relative tw:isolate tw:min-h-screen tw:overflow-y-auto tw:bg-dwarpal-surface tw:font-sans tw:text-dwarpal-ink"
      style={{
        backgroundImage: `
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.95) 0, rgba(255, 255, 255, 0.42) 24%, transparent 46%),
          radial-gradient(circle at top right, rgba(184, 226, 255, 0.52) 0, transparent 34%),
          radial-gradient(circle at bottom left, rgba(205, 236, 255, 0.5) 0, transparent 28%),
          linear-gradient(180deg, #f6fbff 0%, #edf6ff 52%, #e6f1ff 100%)
        `,
      }}
    >
      {/* Light Blue Glow Orbs */}
      <motion.div
        aria-hidden="true"
        className="tw:absolute tw:-left-20 tw:top-12 tw:h-64 tw:w-64 tw:rounded-full tw:bg-[rgba(171,221,255,0.38)] tw:blur-3xl tw:pointer-events-none"
        animate={reduceMotion ? undefined : { x: [0, 22, 0], y: [0, -18, 0] }}
        transition={reduceMotion ? undefined : { duration: 13, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.div
        aria-hidden="true"
        className="tw:absolute tw:right-[-5rem] tw:top-[-3rem] tw:h-72 tw:w-72 tw:rounded-full tw:bg-[rgba(129,183,255,0.2)] tw:blur-3xl tw:pointer-events-none"
        animate={reduceMotion ? undefined : { x: [0, -28, 0], y: [0, 18, 0] }}
        transition={reduceMotion ? undefined : { duration: 15, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Grid Line Overlays */}
      <div
        aria-hidden="true"
        className="tw:absolute tw:inset-0 tw:opacity-40 tw:pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(122, 154, 194, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(122, 154, 194, 0.08) 1px, transparent 1px)
          `,
          backgroundPosition: 'center center',
          backgroundSize: '140px 140px',
          maskImage: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6), transparent)',
        }}
      />

      <div className="tw:relative tw:z-10 tw:mx-auto tw:flex tw:min-h-screen tw:w-full tw:max-w-[1240px] tw:items-center tw:px-4 tw:py-8 lg:tw:py-12 tw:lg:px-8">
        <motion.main
          initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }
          }
          className="tw:grid tw:w-full tw:overflow-hidden tw:rounded-[34px] tw:border tw:border-white/70 tw:bg-[rgba(255,255,255,0.76)] tw:shadow-[0_34px_110px_rgba(34,87,128,0.16)] tw:backdrop-blur-[22px] tw:lg:grid-cols-[1.1fr_0.9fr] tw:grid-cols-1"
        >
          <div className="tw:order-1 tw:min-w-0 tw:border-b tw:border-white/40 tw:lg:border-b-0 tw:lg:border-r tw:lg:border-white/45">{left}</div>
          <div className="tw:order-2 tw:min-w-0" id="login-card-container">{right}</div>
        </motion.main>
      </div>
    </div>
  )
}
