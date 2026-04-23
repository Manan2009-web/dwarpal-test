import { useEffect, useRef, useState } from 'react'
import { Clock3, ScanLine, ShieldCheck, Sparkles } from 'lucide-react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

const STATUS_ITEMS = [
  {
    label: 'Approval trail',
    value: 'Live',
    icon: ShieldCheck,
  },
  {
    label: 'Movement updates',
    value: 'Real-time',
    icon: ScanLine,
  },
  {
    label: 'Campus uptime',
    value: '24/7',
    icon: Clock3,
  },
]

function useFinePointer() {
  const [canTrack, setCanTrack] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const updateCapability = () => setCanTrack(mediaQuery.matches)

    updateCapability()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateCapability)
      return () => mediaQuery.removeEventListener('change', updateCapability)
    }

    mediaQuery.addListener(updateCapability)
    return () => mediaQuery.removeListener(updateCapability)
  }, [])

  return canTrack
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function MascotPanel() {
  const panelRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const canTrack = useFinePointer()
  const [isActive, setIsActive] = useState(false)
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothX = useSpring(pointerX, { stiffness: 160, damping: 24, mass: 0.8 })
  const smoothY = useSpring(pointerY, { stiffness: 160, damping: 24, mass: 0.8 })
  const bodyShiftX = useTransform(smoothX, [-1, 1], [-10, 10])
  const bodyShiftY = useTransform(smoothY, [-1, 1], [-8, 8])
  const bodyRotate = useTransform(smoothX, [-1, 1], [-3.5, 3.5])
  const headRotateX = useTransform(smoothY, [-1, 1], [5, -5])
  const headRotateY = useTransform(smoothX, [-1, 1], [-8, 8])
  const faceShiftX = useTransform(smoothX, [-1, 1], [-6, 6])
  const faceShiftY = useTransform(smoothY, [-1, 1], [-4, 4])
  const eyeShiftX = useTransform(smoothX, [-1, 1], [-4, 4])
  const eyeShiftY = useTransform(smoothY, [-1, 1], [-3, 3])
  const badgeShiftX = useTransform(smoothX, [-1, 1], [-3, 3])
  const haloShiftX = useTransform(smoothX, [-1, 1], [-22, 22])
  const haloShiftY = useTransform(smoothY, [-1, 1], [-18, 18])
  const shadowScale = useTransform(smoothY, [-1, 1], [0.92, 1.08])

  function resetPointer() {
    pointerX.set(0)
    pointerY.set(0)
  }

  function updatePointer(clientX, clientY) {
    if (!panelRef.current) {
      return
    }

    const bounds = panelRef.current.getBoundingClientRect()
    const x = clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1)
    const y = clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1)

    pointerX.set(x)
    pointerY.set(y)
  }

  function handlePointerEnter() {
    if (reduceMotion || !canTrack) {
      return
    }

    setIsActive(true)
  }

  function handlePointerMove(event) {
    if (reduceMotion || !canTrack) {
      return
    }

    setIsActive(true)
    updatePointer(event.clientX, event.clientY)
  }

  function handlePointerLeave() {
    setIsActive(false)
    resetPointer()
  }

  return (
    <section
      ref={panelRef}
      className="tw:relative tw:flex tw:h-full tw:flex-col tw:overflow-hidden tw:bg-[linear-gradient(180deg,rgba(244,249,255,0.94),rgba(234,244,255,0.9))] tw:p-5 tw:sm:p-7 tw:lg:p-8"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        aria-hidden="true"
        className="tw:absolute tw:inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at top left, rgba(255,255,255,0.86) 0, rgba(255,255,255,0.2) 26%, transparent 42%),
            radial-gradient(circle at bottom right, rgba(139,194,255,0.24) 0, transparent 34%)
          `,
        }}
      />

      <div className="tw:relative tw:z-10 tw:flex tw:h-full tw:flex-col tw:gap-6">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-white/70 tw:bg-white/70 tw:px-4 tw:py-2 tw:text-[0.72rem] tw:font-semibold tw:uppercase tw:tracking-[0.2em] tw:text-[#476884] tw:shadow-[0_12px_24px_rgba(69,111,148,0.08)]">
            <Sparkles className="tw:h-3.5 tw:w-3.5 tw:text-[#2f6db5]" />
            Smart Digital Gatepass System
          </div>
          <div className="tw:inline-flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-[rgba(82,125,165,0.18)] tw:bg-[rgba(255,255,255,0.5)] tw:px-3 tw:py-2 tw:text-[0.82rem] tw:font-medium tw:text-[#476884]">
            <ShieldCheck className="tw:h-4 tw:w-4 tw:text-[#2f6db5]" />
            Trusted by campus teams
          </div>
        </div>

        <div className="tw:max-w-[35rem] tw:space-y-4">
          <h1 className="tw:font-display tw:text-[clamp(2.35rem,5vw,4.4rem)] tw:font-semibold tw:leading-[0.96] tw:tracking-[-0.04em] tw:text-dwarpal-ink">
            Fast approvals. Real-time tracking. Secure campus movement.
          </h1>
          <p className="tw:max-w-[31rem] tw:text-[1rem] tw:leading-7 tw:text-dwarpal-muted tw:sm:text-[1.05rem]">
            DwarPal keeps student and faculty gatepasses in one secure flow, from request to approval to gate
            verification, with the kind of calm clarity a modern campus expects.
          </p>
        </div>

        <div className="tw:relative tw:flex tw:flex-1 tw:min-h-[320px] tw:items-end tw:justify-center tw:overflow-hidden tw:rounded-[32px] tw:border tw:border-white/60 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(236,245,255,0.86))] tw:px-4 tw:py-6 tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_24px_60px_rgba(49,99,145,0.08)] tw:sm:min-h-[360px] tw:lg:min-h-[400px]">
          <div
            aria-hidden="true"
            className="tw:absolute tw:inset-0 tw:opacity-60"
            style={{
              backgroundImage: `
                linear-gradient(rgba(140, 175, 207, 0.12) 1px, transparent 1px),
                linear-gradient(90deg, rgba(140, 175, 207, 0.12) 1px, transparent 1px)
              `,
              backgroundSize: '56px 56px',
              maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.92))',
            }}
          />

          <motion.div
            aria-hidden="true"
            className="tw:absolute tw:left-1/2 tw:top-10 tw:h-44 tw:w-44 tw:-translate-x-1/2 tw:rounded-full tw:bg-[rgba(129,194,255,0.24)] tw:blur-3xl"
            style={{ x: haloShiftX, y: haloShiftY }}
            animate={reduceMotion ? undefined : { scale: isActive ? 1.08 : 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />

          <motion.div
            className="tw:absolute tw:bottom-6 tw:left-1/2 tw:h-8 tw:w-44 tw:-translate-x-1/2 tw:rounded-full tw:bg-[rgba(70,106,142,0.16)] tw:blur-xl"
            style={{ scaleX: shadowScale }}
          />

          <motion.div
            className="tw:relative tw:flex tw:flex-col tw:items-center"
            style={{ x: bodyShiftX, y: bodyShiftY, rotate: bodyRotate }}
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={reduceMotion ? undefined : { duration: isActive ? 3.8 : 5.6, ease: 'easeInOut', repeat: Infinity }}
          >
            <motion.div
              className="tw:absolute tw:right-[-1rem] tw:top-[4.8rem] tw:flex tw:items-center tw:gap-2 tw:rounded-[20px] tw:border tw:border-white/70 tw:bg-[rgba(255,255,255,0.78)] tw:px-3 tw:py-2 tw:text-[0.78rem] tw:font-semibold tw:text-[#325676] tw:shadow-[0_18px_30px_rgba(47,94,136,0.16)]"
              style={{ x: badgeShiftX }}
              animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
              transition={reduceMotion ? undefined : { duration: 4.4, ease: 'easeInOut', repeat: Infinity }}
            >
              <span className="tw:flex tw:h-8 tw:w-8 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-[linear-gradient(180deg,#3e82c9,#285f9e)] tw:text-white">
                <ScanLine className="tw:h-4 tw:w-4" />
              </span>
              Gate synced
            </motion.div>

            <div className="tw:relative tw:flex tw:flex-col tw:items-center">
              <div className="tw:absolute tw:-top-5 tw:flex tw:flex-col tw:items-center">
                <div className="tw:h-6 tw:w-[3px] tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(89,139,185,0.95),rgba(89,139,185,0.35))]" />
                <motion.div
                  className="tw:h-4 tw:w-4 tw:rounded-full tw:border tw:border-white/80 tw:bg-[linear-gradient(180deg,#fefefe,#bddfff)] tw:shadow-[0_8px_18px_rgba(78,124,165,0.22)]"
                  animate={reduceMotion ? undefined : { scale: [1, 1.08, 1] }}
                  transition={reduceMotion ? undefined : { duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
                />
              </div>

              <motion.div
                className="tw:relative tw:h-[11.5rem] tw:w-[9.8rem] tw:rounded-[2.6rem] tw:border tw:border-white/80 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(220,237,255,0.92))] tw:shadow-[0_28px_48px_rgba(47,94,136,0.18)]"
                style={{
                  rotateX: headRotateX,
                  rotateY: headRotateY,
                  x: faceShiftX,
                  y: faceShiftY,
                  transformPerspective: 1100,
                }}
              >
                <div className="tw:absolute tw:inset-x-4 tw:top-3 tw:h-2 tw:rounded-full tw:bg-white/70" />
                <div className="tw:absolute tw:inset-[0.75rem] tw:rounded-[2rem] tw:bg-[linear-gradient(180deg,#1f4367,#153453)] tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
                  <div className="tw:absolute tw:inset-x-4 tw:top-4 tw:h-[1px] tw:bg-white/12" />
                  <div className="tw:absolute tw:inset-x-0 tw:top-6 tw:flex tw:justify-center">
                    <span className="tw:rounded-full tw:bg-[rgba(126,191,255,0.14)] tw:px-3 tw:py-1 tw:text-[0.62rem] tw:font-semibold tw:uppercase tw:tracking-[0.24em] tw:text-[#b9ddff]">
                      Buddy online
                    </span>
                  </div>
                  <div className="tw:absolute tw:left-1/2 tw:top-[4.4rem] tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-3">
                    {[0, 1].map((eye) => (
                      <div
                        key={eye}
                        className="tw:flex tw:h-11 tw:w-11 tw:items-center tw:justify-center tw:rounded-[1.1rem] tw:bg-[rgba(164,219,255,0.16)] tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                      >
                        <motion.div
                          className="tw:flex tw:h-[1.35rem] tw:w-[1.35rem] tw:items-center tw:justify-center tw:rounded-full tw:bg-[linear-gradient(180deg,#93d8ff,#d9f5ff)] tw:shadow-[0_0_18px_rgba(123,210,255,0.4)]"
                          style={{ x: eyeShiftX, y: eyeShiftY }}
                          animate={reduceMotion ? undefined : { scaleY: [1, 1, 0.18, 1, 1] }}
                          transition={
                            reduceMotion
                              ? undefined
                              : {
                                  duration: 6.4,
                                  ease: 'easeInOut',
                                  repeat: Infinity,
                                  repeatDelay: eye === 0 ? 1.2 : 1.35,
                                  times: [0, 0.42, 0.47, 0.54, 1],
                                }
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="tw:absolute tw:bottom-6 tw:left-1/2 tw:h-3 tw:w-12 tw:-translate-x-1/2 tw:rounded-full tw:bg-[rgba(184,230,255,0.14)]" />
                </div>
              </motion.div>

              <div className="tw:relative tw:-mt-2 tw:flex tw:w-[11rem] tw:justify-between">
                <div className="tw:h-16 tw:w-5 tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(196,224,255,0.95),rgba(163,197,232,0.85))] tw:shadow-[0_18px_28px_rgba(47,94,136,0.12)]" />
                <div className="tw:h-16 tw:w-5 tw:rounded-full tw:bg-[linear-gradient(180deg,rgba(196,224,255,0.95),rgba(163,197,232,0.85))] tw:shadow-[0_18px_28px_rgba(47,94,136,0.12)]" />
              </div>

              <div className="tw:relative tw:-mt-7 tw:h-[8.9rem] tw:w-[11.2rem] tw:rounded-[2.8rem] tw:border tw:border-white/80 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(214,232,252,0.9))] tw:shadow-[0_28px_46px_rgba(47,94,136,0.18)]">
                <div className="tw:absolute tw:inset-x-5 tw:top-5 tw:flex tw:items-center tw:justify-between">
                  <span className="tw:text-[0.68rem] tw:font-semibold tw:uppercase tw:tracking-[0.22em] tw:text-[#66809a]">Campus flow</span>
                  <span className="tw:h-2.5 tw:w-2.5 tw:rounded-full tw:bg-[#54c67d]" />
                </div>
                <div className="tw:absolute tw:left-1/2 tw:top-[2.6rem] tw:flex tw:h-[3.9rem] tw:w-[4.9rem] tw:-translate-x-1/2 tw:flex-col tw:items-center tw:justify-center tw:rounded-[1.8rem] tw:bg-[linear-gradient(180deg,#2f6db5,#1f4e84)] tw:text-white tw:shadow-[0_18px_26px_rgba(31,78,132,0.34)]">
                  <ShieldCheck className="tw:h-5 tw:w-5" />
                  <span className="tw:mt-1 tw:text-[0.62rem] tw:font-semibold tw:uppercase tw:tracking-[0.24em]">DP</span>
                </div>
                <div className="tw:absolute tw:bottom-5 tw:left-1/2 tw:flex tw:w-[8rem] tw:-translate-x-1/2 tw:justify-between">
                  <span className="tw:h-2 tw:w-8 tw:rounded-full tw:bg-[rgba(56,107,167,0.18)]" />
                  <span className="tw:h-2 tw:w-4 tw:rounded-full tw:bg-[rgba(56,107,167,0.12)]" />
                  <span className="tw:h-2 tw:w-3 tw:rounded-full tw:bg-[rgba(56,107,167,0.12)]" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="tw:grid tw:gap-3 tw:sm:grid-cols-3">
          {STATUS_ITEMS.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="tw:rounded-[24px] tw:border tw:border-white/65 tw:bg-[rgba(255,255,255,0.7)] tw:p-4 tw:shadow-[0_18px_30px_rgba(69,111,148,0.08)]"
            >
              <div className="tw:flex tw:items-center tw:gap-3">
                <div className="tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-[rgba(47,109,181,0.1)] tw:text-[#2f6db5]">
                  <Icon className="tw:h-4.5 tw:w-4.5" />
                </div>
                <div className="tw:min-w-0">
                  <p className="tw:text-[0.76rem] tw:font-medium tw:uppercase tw:tracking-[0.18em] tw:text-[#6f859a]">{label}</p>
                  <p className="tw:mt-1 tw:text-[1rem] tw:font-semibold tw:text-dwarpal-ink">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
