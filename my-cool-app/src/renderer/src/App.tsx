import { useState } from 'react'

function App(): React.JSX.Element {
  const [hovered, setHovered] = useState<'send' | 'receive' | null>(null)

  return (
    <div className="relative h-screen w-screen flex items-center justify-between overflow-hidden bg-[#0a0b10] text-slate-100 select-none">
      
      {/* Dynamic Ambient Side Glows */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out bg-gradient-to-r from-sky-500/10 via-sky-500/2 to-transparent
          ${hovered === 'send' ? 'opacity-100' : 'opacity-0'}`}
      />
      <div 
        className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out bg-gradient-to-l from-violet-500/10 via-violet-500/2 to-transparent
          ${hovered === 'receive' ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* --- Pure Central Laser Bolt Seam --- */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        {/* Top Straight Laser Segment */}
        <div className="w-[1.5px] flex-1 bg-gradient-to-b from-transparent via-white/50 to-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />

        {/* Center Sharply Angled Lightning Fracture */}
        <div className="relative w-12 h-36 flex items-center justify-center my-[-2px]">
          <svg 
            className="w-full h-full text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] overflow-visible" 
            viewBox="0 0 40 120" 
            fill="none"
          >
            <polyline 
              points="20,0 12,48 28,72 20,120" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Bottom Straight Laser Segment */}
        <div className="w-[1.5px] flex-1 bg-gradient-to-t from-transparent via-white/50 to-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
      </div>

      {/* --- Interactive Left/Right Split Zones --- */}
      
      {/* Left: Send */}
      <section
        onMouseEnter={() => setHovered('send')}
        onMouseLeave={() => setHovered(null)}
        className="relative z-20 flex-1 h-full flex items-center justify-center cursor-pointer group"
      >
        <div className="flex flex-col items-center gap-2 transition-transform duration-300 ease-out group-hover:scale-105">
          <span className={`text-2xl font-light tracking-widest uppercase transition-colors duration-300
            ${hovered === 'send' ? 'text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]' : 'text-slate-400 group-hover:text-white'}`}
          >
            Send
          </span>
          <span className={`text-[10px] tracking-[0.2em] uppercase transition-all duration-300
            ${hovered === 'send' ? 'text-sky-400/70 opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
          >
            Drop or Transfer →
          </span>
        </div>
      </section>

      {/* Right: Receive */}
      <section
        onMouseEnter={() => setHovered('receive')}
        onMouseLeave={() => setHovered(null)}
        className="relative z-20 flex-1 h-full flex items-center justify-center cursor-pointer group"
      >
        <div className="flex flex-col items-center gap-2 transition-transform duration-300 ease-out group-hover:scale-105">
          <span className={`text-2xl font-light tracking-widest uppercase transition-colors duration-300
            ${hovered === 'receive' ? 'text-violet-400 drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]' : 'text-slate-400 group-hover:text-white'}`}
          >
            Receive
          </span>
          <span className={`text-[10px] tracking-[0.2em] uppercase transition-all duration-300
            ${hovered === 'receive' ? 'text-violet-400/70 opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
          >
            ← Enter Code or Host
          </span>
        </div>
      </section>

    </div>
  )
}

export default App