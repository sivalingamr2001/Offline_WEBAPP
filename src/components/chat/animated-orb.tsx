export function AnimatedOrb() {
  return (
    <div className="mb-4 flex items-center justify-center">
      <div
        className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-105"
        style={{
          backgroundColor: "rgb(207, 241, 244)",
          boxShadow: "rgba(17, 12, 46, 0.15) 0px 48px 100px 0px",
        }}
      >
        <div className="absolute inset-0 flex animate-pulse items-center justify-center duration-3000">
          <div className="absolute h-14 w-14 rounded-full bg-violet-400/90 mix-blend-multiply blur-sm filter"></div>
          <div className="absolute h-11 w-11 rounded-full bg-fuchsia-400/85 mix-blend-multiply blur-sm filter"></div>
          <div className="absolute h-16 w-16 rounded-full bg-lime-400/90 mix-blend-multiply blur-sm filter"></div>
          <div className="absolute h-8 w-8 rounded-full bg-indigo-200/80 mix-blend-multiply blur-sm filter"></div>
          <div className="absolute h-10 w-10 rounded-full bg-pink-400/85 mix-blend-multiply blur-sm filter"></div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent" />
      </div>
    </div>
  )
}
