export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden>
      {[0, 0.25, 0.5, 0.15].map((delay, i) => (
        <span
          key={i}
          className={`w-[4px] rounded-full bg-white ${playing ? 'eq-bar' : ''}`}
          style={{
            height: '100%',
            animationDelay: `${delay}s`,
            transform: playing ? undefined : 'scaleY(0.35)',
          }}
        />
      ))}
    </div>
  )
}
