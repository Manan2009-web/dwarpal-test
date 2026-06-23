import { motion } from 'framer-motion'
import { Shield, QrCode, Clock, Bell, ArrowRight, Sparkles } from 'lucide-react'
import logo from '../../assets/dwarpal_logo.png'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
}

const features = [
  {
    icon: QrCode,
    title: 'Instant QR Pass',
    description: 'Secure, encrypted QR passes generated instantly upon approval for rapid gate checks.'
  },
  {
    icon: Shield,
    title: 'Controlled Workflows',
    description: 'Multi-level approval pathways routing through Coordinators, HODs, and Principals.'
  },
  {
    icon: Clock,
    title: 'Real-time Tracking',
    description: 'Live entry/exit logs at the security desk keeping operations fully accountable.'
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Instant notifications when passes are submitted, forwarded, or completed.'
  }
]

export default function LandingPanel() {
  const handleScrollToLogin = () => {
    const loginCard = document.getElementById('login-card-container')
    if (loginCard) {
      loginCard.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="tw:relative tw:flex tw:h-full tw:w-full tw:flex-col tw:justify-between tw:bg-[linear-gradient(180deg,rgba(242,248,255,0.9),rgba(232,243,255,0.86))] tw:p-6 tw:sm:p-8 tw:lg:p-12 tw:text-dwarpal-ink tw:overflow-hidden">
      {/* Abstract Glowing Accent Overlays */}
      <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:-left-20 tw:-top-20 tw:h-80 tw:w-80 tw:rounded-full tw:bg-sky-200/50 tw:blur-[100px]" />
      <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:-right-20 tw:-bottom-20 tw:h-96 tw:w-96 tw:rounded-full tw:bg-indigo-100/40 tw:blur-[120px]" />
      
      {/* Subtle Dot Grid Background */}
      <div 
        aria-hidden="true" 
        className="tw:pointer-events-none tw:absolute tw:inset-0 tw:opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgba(105, 143, 176, 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="tw:relative tw:z-10 tw:flex tw:h-full tw:flex-col tw:justify-between tw:gap-8"
      >
        {/* Brand Header */}
        <motion.div variants={itemVariants} className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-white tw:border tw:border-white/80 tw:shadow-md">
            <img src={logo} alt="DwarPal" className="tw:h-6 tw:w-6 tw:object-contain" />
          </div>
          <div>
            <h1 className="tw:font-display tw:text-lg tw:font-bold tw:tracking-tight tw:text-dwarpal-ink">
              DwarPal
            </h1>
            <span className="tw:text-[0.65rem] tw:font-semibold tw:uppercase tw:tracking-[0.2em] tw:text-[#2f6db5]">
              Smart Gatepass System
            </span>
          </div>
        </motion.div>

        {/* Hero Section */}
        <div className="tw:space-y-6 tw:my-auto">
          <motion.div variants={itemVariants} className="tw:inline-flex tw:items-center tw:gap-2 tw:rounded-full tw:bg-[rgba(47,109,181,0.08)] tw:border tw:border-[rgba(47,109,181,0.18)] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#2f6db5]">
            <Sparkles size={14} className="tw:text-[#2f6db5]" />
            <span>Next-Gen Access Management</span>
          </motion.div>

          <motion.h2 
            variants={itemVariants}
            className="tw:font-display tw:text-3xl tw:font-extrabold tw:leading-tight tw:tracking-tight tw:text-dwarpal-ink tw:sm:text-4xl tw:lg:text-5xl"
          >
            Securing campus <br />
            <span className="tw:bg-gradient-to-r tw:from-[#387dcc] tw:to-[#25578f] tw:bg-clip-text tw:text-transparent">
              access workflows.
            </span>
          </motion.h2>

          <motion.p 
            variants={itemVariants}
            className="tw:max-w-md tw:text-sm tw:leading-relaxed tw:text-dwarpal-muted tw:sm:text-base"
          >
            DwarPal digitizes authorization loops, replacing paper slips with instant verification, cryptographic security, and automated multi-level audits.
          </motion.p>

          <motion.div variants={itemVariants} className="tw:lg:hidden">
            <button
              onClick={handleScrollToLogin}
              className="tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:bg-[linear-gradient(135deg,#387dcc,#25578f)] tw:px-5 tw:py-3.5 tw:text-sm tw:font-semibold tw:text-white tw:shadow-[0_20px_38px_rgba(37,87,143,0.22)] tw:transition-all tw:duration-200 hover:tw:shadow-[0_24px_44px_rgba(37,87,143,0.3)] focus:tw:ring-2 focus:tw:ring-[#2f6db5]/50"
            >
              Access Portal
              <ArrowRight size={16} />
            </button>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div 
          variants={itemVariants}
          className="tw:grid tw:gap-4 tw:sm:grid-cols-2 tw:lg:gap-6"
        >
          {features.map((feature, i) => (
            <div 
              key={i}
              className="tw:group tw:rounded-2xl tw:border tw:border-[rgba(105,143,176,0.14)] tw:bg-white/50 tw:p-4 tw:transition-all tw:duration-300 hover:tw:border-[rgba(47,109,181,0.28)] hover:tw:bg-white/80 hover:tw:shadow-[0_12px_24px_rgba(34,87,128,0.06)]"
            >
              <div className="tw:flex tw:items-center tw:gap-3">
                <div className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-lg tw:bg-[rgba(47,109,181,0.06)] tw:border tw:border-[rgba(47,109,181,0.12)] tw:text-[#2f6db5] tw:transition-colors tw:duration-300 group-hover:tw:bg-[#2f6db5]/10 group-hover:tw:text-[#21538c]">
                  <feature.icon size={18} />
                </div>
                <h3 className="tw:text-sm tw:font-semibold tw:text-dwarpal-ink">
                  {feature.title}
                </h3>
              </div>
              <p className="tw:mt-2 tw:text-xs tw:leading-relaxed tw:text-dwarpal-muted group-hover:tw:text-dwarpal-ink">
                {feature.description}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Footer info */}
        <motion.div 
          variants={itemVariants}
          className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-[rgba(98,128,154,0.12)] tw:pt-6 tw:text-[0.7rem] tw:text-[#889cb0]"
        >
          <span>DwarPal v1.5 Standalone</span>
          <span className="tw:flex tw:items-center tw:gap-1.5">
            <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-emerald-500 tw:animate-pulse" />
            Operational & Secure
          </span>
        </motion.div>
      </motion.div>
    </section>
  )
}
