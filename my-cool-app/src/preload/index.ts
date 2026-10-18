import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Sender
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  startServer: (filePath: string) => ipcRenderer.invoke('start-server', filePath),
  stopServer: () => ipcRenderer.invoke('stop-server'),

  // Receiver
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening'),
  receiveFile: (senderIP: string) => ipcRenderer.invoke('receive-file', senderIP),

  // Main → Renderer push
  onPeersUpdated: (callback: (peers: { hostname: string; ip: string }[]) => void) => {
    ipcRenderer.on('peers-updated', (_event, peers) => callback(peers))
  },
  offPeersUpdated: () => {
    ipcRenderer.removeAllListeners('peers-updated')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}