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

function getHostname(): string {
  return os.hostname()
}

// ─── State ─────────────────────────────────────────────────────────────────

let activeServer: http.Server | null = null
let broadcastSocket: dgram.Socket | null = null
let broadcastInterval: NodeJS.Timeout | null = null
let listenerSocket: dgram.Socket | null = null
let mainWindow: BrowserWindow | null = null
const knownPeers: Record<string, string> = {} // ip → hostname

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
    const hostname = knownPeers[cleanIP] ?? cleanIP
    mainWindow?.webContents.send('file-grabbed', { hostname })
  })

  expressApp.get('/ping', (_req, res) => {
    res.json({ fileName: path.basename(filePath) })
  })

  await new Promise<void>((resolve) => {
    activeServer = expressApp.listen(HTTP_PORT, () => resolve())
  })

  // Also listen for peers so we can resolve hostnames when they grab the file
  if (!listenerSocket) {
    listenerSocket = dgram.createSocket('udp4')
       listenerSocket.on('message', (msg) => {
      const str = msg.toString()
      console.log('UDP received on sender:', str)
      if (!str.startsWith('ZAP:')) return
      const [, hostname, ip] = str.split(':')
      if (ip === getLocalIP()) return
      knownPeers[ip] = hostname
    })
    listenerSocket.bind(UDP_PORT)
  }

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
ipcMain.handle('start-listening', async () => {
  if (listenerSocket) { listenerSocket.close(); listenerSocket = null }

  const peers: Record<string, { hostname: string; ip: string; lastSeen: number }> = {}

  listenerSocket = dgram.createSocket('udp4')

  listenerSocket.on('message', (msg) => {
    const str = msg.toString()
    if (!str.startsWith('ZAP:')) return

    const [, hostname, ip] = str.split(':')

    // Ignore ourselves
    if (ip === getLocalIP()) return

    knownPeers[ip] = hostname
    peers[ip] = { hostname, ip, lastSeen: Date.now() }

    // Prune peers not seen in 3 seconds
    const now = Date.now()
    for (const key of Object.keys(peers)) {
      if (now - peers[key].lastSeen > 3000) delete peers[key]
    }

    // Push updated list to renderer
    mainWindow?.webContents.send(
      'peers-updated',
      Object.values(peers)
    )
  })

  listenerSocket.bind(UDP_PORT)
})

// 5. Stop listening
ipcMain.handle('stop-listening', async () => {
  if (listenerSocket) { listenerSocket.close(); listenerSocket = null }
})

// 6. Receive file from a peer
ipcMain.handle('receive-file', async (_event, senderIP: string) => {
  const pingRes = await fetch(`http://${senderIP}:${HTTP_PORT}/ping`)
  const { fileName } = await pingRes.json()

  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const timestampedName = `${base}_${timestamp}${ext}`

  const { filePath: savePath, canceled } = await dialog.showSaveDialog({
    defaultPath: timestampedName
  })
  if (canceled || !savePath) return { success: false }

  const fileRes = await fetch(`http://${senderIP}:${HTTP_PORT}/file`)
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
  if (listenerSocket) listenerSocket.close()
  if (process.platform !== 'darwin') app.quit()
})