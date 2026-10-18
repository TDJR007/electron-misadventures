import { useState, useEffect } from 'react'

type Mode = 'idle' | 'sending' | 'receiving'
type Peer = { hostname: string; ip: string }

function App(): React.JSX.Element {
  const [hovered, setHovered] = useState<'send' | 'receive' | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [status, setStatus] = useState<string>('')
  const [serverInfo, setServerInfo] = useState<{ ip: string; port: number; hostname: string } | null>(null)
  const [peers, setPeers] = useState<Peer[]>([])

  // Start listening for peers when receive side is hovered or active
  useEffect(() => {
    if (hovered === 'receive' || mode === 'receiving') {
      window.api.startListening()
      window.api.onPeersUpdated((updatedPeers) => setPeers(updatedPeers))
    } else {
      window.api.stopListening()
      window.api.offPeersUpdated()
      setPeers([])
    }

    return () => {
      window.api.stopListening()
      window.api.offPeersUpdated()
    }
  }, [hovered, mode])

  const handleSend = async (): Promise<void> => {
    const file = await window.api.openFileDialog()
    if (!file) return

    setStatus(`Starting server...`)
    setMode('sending')

    const info = await window.api.startServer(file.filePath)
    setServerInfo(info)
    setStatus(`Sharing ${file.fileName}`)
  }

  const handleReceive = async (peer: Peer): Promise<void> => {
    setMode('receiving')
    setStatus(`Connecting to ${peer.hostname}...`)

    try {
      const result = await window.api.receiveFile(peer.ip)
      if (result.success) {
        setStatus(`Saved to: ${result.savedAt}`)
      } else {
        setStatus('Cancelled.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not receive the file.')
    } finally {
      setMode('idle')
    }
  }

  useEffect(() => {
    window.api.onFileGrabbed((info) => {
      setStatus(`Grabbed by ${info.hostname}`)
    })
    return () => window.api.offFileGrabbed()
  }, [])

  const handleReset = async (): Promise<void> => {
    await window.api.stopServer()
    setMode('idle')
    setStatus('')
    setServerInfo(null)
  }

  return (
    <div className="relative h-screen w-screen flex flex-col items-center justify-between overflow-hidden bg-[#0a0b10] text-slate-100 select-none">

      {/* Ambient glows */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 bg-gradient-to-r from-sky-500/10 via-sky-500/2 to-transparent
        ${hovered === 'send' || mode === 'sending' ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 bg-gradient-to-l from-violet-500/10 via-violet-500/2 to-transparent
        ${hovered === 'receive' || mode === 'receiving' ? 'opacity-100' : 'opacity-0'}`} />

      {/* Lightning seam */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <div className="w-[1.5px] flex-1 bg-gradient-to-b from-transparent via-white/50 to-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
        <div className="relative w-12 h-36 flex items-center justify-center my-[-2px]">
          <svg className="w-full h-full text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] overflow-visible" viewBox="0 0 40 120" fill="none">
            <polyline points="20,0 12,48 28,72 20,120" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="w-[1.5px] flex-1 bg-gradient-to-t from-transparent via-white/50 to-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
      </div>

      {/* Main content */}
      <div className="relative z-20 flex-1 w-full flex items-center">

        {/* Send side */}
        <section
          onMouseEnter={() => setHovered('send')}
          onMouseLeave={() => setHovered(null)}
          className="flex-1 h-full flex flex-col items-center justify-center gap-4 cursor-pointer group"
          onClick={mode === 'idle' ? handleSend : undefined}
        >
          {mode === 'sending' && serverInfo ? (
            <div className="flex flex-col items-center gap-3 w-full px-12 overflow-hidden">
              <span className="text-sky-400/60 text-[10px] tracking-widest uppercase">broadcasting as</span>
              <span className="text-sky-300 text-lg font-mono truncate max-w-full">{serverInfo.hostname}</span>
              <span className="text-sky-400/40 text-[10px] font-mono">{serverInfo.ip}:{serverInfo.port}</span>
              <div className="flex gap-1 mt-1">
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-bounce [animation-delay:300ms]" />
              </div>
              {status && (
                <span className="text-[10px] text-sky-400 tracking-widest uppercase animate-pulse">
                  {status}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleReset() }}
                className="mt-2 text-[10px] text-slate-600 hover:text-red-400 transition-colors tracking-widest uppercase"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 transition-transform duration-300 ease-out group-hover:scale-105">
              <span className={`text-2xl font-light tracking-widest uppercase transition-colors duration-300
                ${hovered === 'send' ? 'text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]' : 'text-slate-400'}`}>
                Send
              </span>
              <span className={`text-[10px] tracking-[0.2em] uppercase transition-all duration-300
                ${hovered === 'send' ? 'text-sky-400/70 opacity-100' : 'opacity-0'}`}>
                Click to pick a file
              </span>
            </div>
          )}
        </section>

        {/* Receive side */}
        <section
          onMouseEnter={() => setHovered('receive')}
          onMouseLeave={() => setHovered(null)}
          className="flex-1 h-full flex flex-col items-center justify-center gap-4 group"
        >
          {mode === 'receiving' ? (
            <span className="text-violet-400 text-sm tracking-widest uppercase animate-pulse">
              Receiving...
            </span>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full px-12">
              <span className={`text-2xl font-light tracking-widest uppercase transition-colors duration-300
                ${hovered === 'receive' ? 'text-violet-400 drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]' : 'text-slate-400'}`}>
                Receive
              </span>

              {/* Peer list */}
              {hovered === 'receive' && (
                <div className="w-full flex flex-col gap-2 mt-2">
                  {peers.length === 0 ? (
                    <span className="text-center text-[10px] text-slate-600 tracking-widest uppercase animate-pulse">
                      Scanning...
                    </span>
                  ) : (
                    peers.map((peer) => (
                      <button
                        key={peer.ip}
                        onClick={() => handleReceive(peer)}
                        className="w-full py-2 px-4 border border-violet-500/20 hover:border-violet-400/60 hover:bg-violet-500/10 transition-all duration-200 text-sm text-violet-300 font-mono tracking-wide"
                      >
                        {peer.hostname}
                        <span className="text-violet-500/40 text-[10px] ml-2">{peer.ip}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {status && mode === 'idle' && (
                <span className="text-[10px] text-sky-400 tracking-widest uppercase animate-pulse">{status}</span>
              )}
              {!hovered && !status && (
                <span className="text-[10px] tracking-[0.2em] uppercase text-slate-600">
                  Hover to scan
                </span>
              )}
            </div>
          )}
        </section>

      </div>

      {status && (
        <div role="status" className="relative z-20 w-full text-center text-[10px] tracking-widest text-slate-500 pb-4 uppercase">
          {status}
        </div>
      )}

    </div>
  )
}

export default App
