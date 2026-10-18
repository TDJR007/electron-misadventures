# my-cool-app

An Electron application with React and TypeScript for LAN file sharing.

- UDP peer discovery with hostname broadcasting
- Single shared UDP socket with flag-based renderer push
- HTTP file server via Express (sender side)
- Native OS file picker + save dialog
- Timestamped filenames to prevent overwrites
- Sender notified by hostname when file is grabbed
- Split-screen synthwave UI with lightning seam divider

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
