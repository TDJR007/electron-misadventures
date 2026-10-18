import { ElectronAPI } from '@electron-toolkit/preload'

type ReceiveFileResult = { success: true; savedAt: string } | { success: false }
type Peer = { hostname: string; ip: string }

interface ZapAPI {
  openFileDialog: () => Promise<{ filePath: string; fileName: string } | null>
  startServer: (filePath: string) => Promise<{ ip: string; port: number; hostname: string }>
  stopServer: () => Promise<void>
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
  receiveFile: (senderIP: string) => Promise<ReceiveFileResult>
  onPeersUpdated: (callback: (peers: Peer[]) => void) => void
  offPeersUpdated: () => void
  onFileGrabbed: (callback: (info: { hostname: string }) => void) => void
  offFileGrabbed: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ZapAPI
  }
}

