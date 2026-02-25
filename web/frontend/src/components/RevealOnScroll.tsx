import { useRef, useEffect, useState, ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** Delay in ms for stagger effects */
  delay?: number
  /** Animation direction: up | down */
  direction?: 'up' | 'down'
  /** IntersectionObserver threshold 0-1 */
  threshold?: number
}

export function RevealOnScroll({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  threshold = 0.1,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setVisible(true)
          setHasAnimated(true)
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, hasAnimated])

  const translateY = direction === 'up' ? 24 : -24

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
      style={{
        transform: visible ? 'translateY(0)' : `translateY(${translateY}px)`,
        transitionDelay: visible ? `${delay}ms` : '0ms',
      }}
    >
      {children}
    </div>
  )
}
