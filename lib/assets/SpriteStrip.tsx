'use client'

import React from 'react'
import { getSpriteAnimation } from './catalog'

interface Props {
  animationId: string
  scale?: number
  className?: string
  title?: string
}

export default function SpriteStrip({ animationId, scale = 1, className, title }: Props) {
  const animation = getSpriteAnimation(animationId)
  if (!animation) return null

  const horizontal = animation.direction !== 'vertical'
  const duration = animation.frames / Math.max(1, animation.fps)
  const width = animation.frameWidth * scale
  const height = animation.frameHeight * scale
  const backgroundSize = horizontal
    ? `${animation.frames * 100}% 100%`
    : `100% ${animation.frames * 100}%`
  const finalPosition = horizontal ? '100% 0' : '0 100%'

  return (
    <span
      role="img"
      aria-label={title ?? animation.id}
      className={className}
      style={{
        display: 'inline-block',
        width,
        height,
        backgroundImage: `url(${animation.src})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize,
        imageRendering: 'auto',
        animation: `noxia-sprite-${animation.id} ${duration}s steps(${animation.frames - 1}) infinite`,
      }}
    >
      <style>{`@keyframes noxia-sprite-${animation.id}{from{background-position:0 0}to{background-position:${finalPosition}}}`}</style>
    </span>
  )
}
