import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import express from 'express'
import * as fs from 'fs'
import * as http from 'http'
import * as os from 'os'
import * as path from 'path'
import * as dgram from 'dgram'

// ─── Constants ─────────────────────────────────────────────────────────────

const HTTP_PORT = 3000
const UDP_PORT = 41234
const BROADCAST_ADDR = '255.255.255.255'
const BROADCAST_INTERVAL = 1000

// ─── Helpers ───────────────────────────────────────────────────────────────

function getLocalIP(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

function isLocalIP(ip: string): boolean {
  const interfaces = os.networkInterfaces()
  return Object.values(interfaces).some((networkInterfaces) =>
    networkInterfaces?.some((iface) => iface.family === 'IPv4' && iface.address === ip)
  )
}

function getHostname(): string {
  return os.hostname()
}

// ─── State ─────────────────────────────────────────────────────────────────

let activeServer: http.Server | null = null
let broadcastSocket: dgram.Socket | null = null
let broadcastInterval: NodeJS.Timeout | null = null
let mainWindow: BrowserWindow | null = null
const knownPeers: Record<string, string> = {}
const knownPeersFull: Record<string, { hostname: string; ip: string; lastSeen: number }> = {}
let pushPeersToRenderer = false

const udpSocket = dgram.createSocket('udp4')
udpSocket.bind(UDP_PORT, () => {
  udpSocket.on('message', (msg, rinfo) => {
    const str = msg.toString()
    if (!str.startsWith('ZAP:')) return
    const [, hostname] = str.split(':')
    const ip = rinfo.address
    if (isLocalIP(ip)) return

    // Always learn hostnames
    knownPeers[ip] = hostname

    // Only push to renderer when receiver is active
    if (!pushPeersToRenderer) return

    knownPeersFull[ip] = { hostname, ip, lastSeen: Date.now() }

    const now = Date.now()
    for (const key of Object.keys(knownPeersFull)) {
      if (now - knownPeersFull[key].lastSeen > 3000) delete knownPeersFull[key]
    }

    mainWindow?.webContents.send('peers-updated', Object.values(knownPeersFull))
  })
})

// ─── Window ────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────

// 1. Open file picker
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'] })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  return { filePath, fileName: path.basename(filePath) }
})

// 2. Start HTTP server + UDP broadcast
ipcMain.handle('start-server', async (_event, filePath: string) => {
  // Kill existing
  if (activeServer) { activeServer.close(); activeServer = null }
  if (broadcastInterval) { clearInterval(broadcastInterval); broadcastInterval = null }
  if (broadcastSocket) { broadcastSocket.close(); broadcastSocket = null }

  // HTTP server
  const expressApp = express()

  expressApp.get('/file', (req, res) => {
    const fileName = path.basename(filePath)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.sendFile(filePath)
    const cleanIP = req.ip?.replace('::ffff:', '') ?? ''
    console.log('knownPeers:', JSON.stringify(knownPeers))
    console.log('cleanIP:', cleanIP)
    const hostname = knownPeers[cleanIP] ?? cleanIP
    mainWindow?.webContents.send('file-grabbed', { hostname })
  })

  expressApp.get('/ping', (_req, res) => {
    res.json({ fileName: path.basename(filePath) })
  })

  await new Promise<void>((resolve) => {
    activeServer = expressApp.listen(HTTP_PORT, () => resolve())
  })

  // UDP broadcast
  broadcastSocket = dgram.createSocket('udp4')
  broadcastSocket.bind(0, () => {
    broadcastSocket!.setBroadcast(true)
    const ip = getLocalIP()
    const hostname = getHostname()
    const message = Buffer.from(`ZAP:${hostname}:${ip}`)

    broadcastInterval = setInterval(() => {
      broadcastSocket!.send(message, 0, message.length, UDP_PORT, BROADCAST_ADDR)
    }, BROADCAST_INTERVAL)
  })

  return { ip: getLocalIP(), port: HTTP_PORT, hostname: getHostname() }
})

// 3. Stop server + broadcast
ipcMain.handle('stop-server', async () => {
  if (activeServer) { activeServer.close(); activeServer = null }
  if (broadcastInterval) { clearInterval(broadcastInterval); broadcastInterval = null }
  if (broadcastSocket) { broadcastSocket.close(); broadcastSocket = null }
})

// 4. Start listening for peers (receiver side)
// 4. Start listening — just flip on renderer pushes, socket already running
ipcMain.handle('start-listening', async () => {
  udpSocket.removeAllListeners('message')
  udpSocket.on('message', (msg, rinfo) => {
    const str = msg.toString()
    if (!str.startsWith('ZAP:')) return

    const [, hostname] = str.split(':')
    const ip = rinfo.address
    if (isLocalIP(ip)) return

    knownPeers[ip] = hostname
    knownPeersFull[ip] = { hostname, ip, lastSeen: Date.now() }

    const now = Date.now()
    for (const key of Object.keys(knownPeersFull)) {
      if (now - knownPeersFull[key].lastSeen > 3000) delete knownPeersFull[key]
    }

    mainWindow?.webContents.send('peers-updated', Object.values(knownPeersFull))
  })
})

// 5. Stop pushing to renderer but keep socket alive
ipcMain.handle('stop-listening', async () => {
  pushPeersToRenderer = false
})

// 6. Receive file from a peer
ipcMain.handle('receive-file', async (_event, senderIP: string) => {
  let pingRes: Response
  try {
    pingRes = await fetch(`http://${senderIP}:${HTTP_PORT}/ping`)
  } catch (error) {
    throw new Error(`Could not connect to ${senderIP}. Make sure the sender is sharing and both devices are on the same network.`, {
      cause: error
    })
  }

  if (!pingRes.ok) {
    if (pingRes.status === 404) {
      throw new Error(
        `No /ping endpoint found at ${senderIP}:${HTTP_PORT}. The device is reachable, but it may be running an older Zap sender or another service on port ${HTTP_PORT}. Update/restart the sender and share the file again.`
      )
    }
    throw new Error(`The sender returned HTTP ${pingRes.status} for /ping. Make sure the sender is running this app and sharing a file.`)
  }

  const contentType = pingRes.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`The sender returned ${contentType || 'an unknown content type'} instead of JSON for /ping. Make sure the sender is running this app and sharing a file.`)
  }

  let pingData: unknown
  try {
    pingData = await pingRes.json()
  } catch (error) {
    throw new Error('The sender returned invalid JSON for /ping. Make sure the sender is running the same version of this app.', {
      cause: error
    })
  }
  if (
    typeof pingData !== 'object' ||
    pingData === null ||
    !('fileName' in pingData) ||
    typeof pingData.fileName !== 'string' ||
    pingData.fileName.length === 0
  ) {
    throw new Error('The sender returned an invalid file name. Make sure the sender is running the same version of this app.')
  }
  const { fileName } = pingData

  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const timestampedName = `${base}_${timestamp}${ext}`

  const { filePath: savePath, canceled } = await dialog.showSaveDialog({
    defaultPath: timestampedName
  })
  if (canceled || !savePath) return { success: false }

  let fileRes: Response
  try {
    fileRes = await fetch(`http://${senderIP}:${HTTP_PORT}/file`)
  } catch (error) {
    throw new Error(`The connection to ${senderIP} was lost while downloading the file. Try starting the share again.`, {
      cause: error
    })
  }
  if (!fileRes.ok) {
    throw new Error(`The sender returned HTTP ${fileRes.status} while sending the file. Try starting the share again.`)
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer())
  fs.writeFileSync(savePath, buffer)

  return { success: true, savedAt: savePath }
})

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (activeServer) activeServer.close()
  if (broadcastInterval) clearInterval(broadcastInterval)
  if (broadcastSocket) broadcastSocket.close()
  udpSocket.close()
  if (process.platform !== 'darwin') app.quit()
})