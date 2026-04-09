import logo from '../assets/dwarpal_logo.png'

const SIZE_VARIANTS = new Set(['sm', 'md', 'lg'])
const LAYOUT_VARIANTS = new Set(['inline', 'stacked'])
const ALIGN_VARIANTS = new Set(['center', 'start'])

export default function AppBrand({
  size = 'md',
  logo: logoSrc = logo,
  appName = 'DwarPal',
  centered = false,
  layout = 'inline',
  align = 'center',
}) {
  const resolvedSize = SIZE_VARIANTS.has(size) ? size : 'md'
  const resolvedLayout = LAYOUT_VARIANTS.has(layout) ? layout : 'inline'
  const resolvedAlign = ALIGN_VARIANTS.has(align) ? align : 'center'
  const isStacked = resolvedLayout === 'stacked'
  const isLeftAligned = !isStacked && resolvedAlign === 'start'
  const gapClassName = isStacked ? 'gap-2' : resolvedSize === 'sm' ? 'gap-1' : 'gap-2'
  const titleSizeClassNames =
    resolvedSize === 'sm' && !isStacked
      ? ['text-base', 'md:text-lg']
      : ['text-xl', 'md:text-2xl', 'lg:text-3xl']
  const brandClassName = [
    'brand',
    `brand-${resolvedSize}`,
    `brand-${resolvedLayout}`,
    'flex',
    isStacked ? 'flex-col' : '',
    'items-center',
    isLeftAligned ? 'justify-start' : 'justify-center',
    gapClassName,
    centered ? 'mx-auto' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const logoClassName = [
    'brand-logo',
    'h-16',
    'md:h-20',
    'lg:h-24',
    'w-auto',
    centered || isStacked ? 'mx-auto' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const titleClassName = [
    'brand-title',
    ...titleSizeClassNames,
    'font-bold',
    'leading-none',
    'tracking-wide',
    isStacked ? 'text-center' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={brandClassName}>
      <img src={logoSrc} alt={`${appName} logo`} className={logoClassName} />
      <p className={titleClassName}>{appName}</p>
    </div>
  )
}
