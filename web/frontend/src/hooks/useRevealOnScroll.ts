import { useEffect, useRef, useState } from 'react'

/** Reveal on scroll: elements fade+slide in when they enter viewport */
export function useRevealOnScroll<T extends HTMLElement>(options?: { threshold?: number; rootMargin?: string }) {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px' } = options ?? {}

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return { ref, isVisible }
}
