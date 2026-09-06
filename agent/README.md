# PagePrint Windows Desktop Agent

This lightweight agent runs quietly in the background on the print shop's Windows counter PC.

### How It Works:
1. **Zero Popups**: Bypasses the browser print dialog. Spools raw PDF jobs directly to the Windows Spooler (`winspool.drv`).
2. **Auto-Routing**: Automatically directs Black & White jobs to your high-speed laser machine (e.g. Canon/HP) and color photos to your ink-tank machine (e.g. Epson).
3. **100% Privacy**: Deletes the customer's PDF from the counter PC hard drive immediately after printing.

### Quick Start:
```bash
cd agent
npm install
npm start
```
