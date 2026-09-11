/**
 * PagePrint Desktop Agent (Windows Background Worker)
 * --------------------------------------------------
 * 1. Auto-discovers physical printers connected via USB, LAN, or Wi-Fi.
 * 2. Syncs real Windows hardware printers to PagePrint Cloud.
 * 3. Continuously polls the shop queue on https://pageprint.in.
 * 4. Silently sends PDF jobs directly to the Windows Spooler with exact copies, duplex & color settings.
 * 5. Instantly wipes temporary files for 100% customer privacy.
 */

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const readline = require('readline');

// Determine runtime directory (supports PagePrint.exe and node index.js)
const baseDir = (process.execPath && process.execPath.toLowerCase().endsWith('pageprint.exe'))
  ? path.dirname(process.execPath)
  : __dirname;

const CONFIG_FILE = path.join(baseDir, 'config.json');
let savedConfig = {};
if (fs.existsSync(CONFIG_FILE)) {
  try {
    savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {}
}

const CONFIG = {
  shopSlug: process.env.PAGEPRINT_SHOP_SLUG || savedConfig.shopSlug || '',
  serverUrl: process.env.PAGEPRINT_SERVER_URL || savedConfig.serverUrl || 'https://www.pageprint.in',
  pollIntervalMs: 3000,
  tempDir: path.join(baseDir, 'temp')
};

if (!fs.existsSync(CONFIG.tempDir)) {
  fs.mkdirSync(CONFIG.tempDir, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    fs.appendFileSync(path.join(CONFIG.tempDir, 'agent.log'), line + '\n');
  } catch (e) {}
  try {
    process.stdout.write(line + '\n');
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  log(`CRASH uncaughtException: ${err ? (err.stack || err.message) : err}`);
});
process.on('unhandledRejection', (reason) => {
  log(`CRASH unhandledRejection: ${reason ? (reason.stack || reason.message || reason) : reason}`);
});

function promptShopSlug() {
  return new Promise((resolve) => {
    if (CONFIG.shopSlug && CONFIG.shopSlug.trim()) {
      return resolve(CONFIG.shopSlug.trim());
    }
    if (!process.stdin.isTTY) {
      CONFIG.shopSlug = 'abcd';
      return resolve('abcd');
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    log('\n====================================================');
    log(' FIRST-TIME SETUP: Please enter your Shop Slug');
    log(' (Found on your dashboard: e.g. "krishna-xerox")');
    log('====================================================');
    rl.question('Enter Shop Slug: ', (slugAns) => {
      const slug = slugAns.trim() || 'krishna-xerox';
      CONFIG.shopSlug = slug;
      
      log('\nServer Environment:');
      log(' 1. Cloud Production (https://www.pageprint.in) [Default]');
      log(' 2. Localhost Test   (http://localhost:3000)');
      rl.question('Choose Server [1 or 2, default 1]: ', (srvAns) => {
        rl.close();
        if (srvAns.trim() === '2') {
          CONFIG.serverUrl = 'http://localhost:3000';
        } else {
          CONFIG.serverUrl = 'https://www.pageprint.in';
        }

        try {
          fs.writeFileSync(CONFIG_FILE, JSON.stringify({ shopSlug: slug, serverUrl: CONFIG.serverUrl }, null, 2));
          log(`\n✅ Saved configuration to ${CONFIG_FILE}\n`);
        } catch (err) {}
        resolve(slug);
      });
    });
  });
}

function makeRequest(url, method = 'GET', data = null, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Too many HTTP redirects'));
    }
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = data ? JSON.stringify(data) : null;
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PagePrint-DesktopAgent/1.0',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        // Automatically follow HTTP 301, 302, 307, 308 redirects (e.g. apex to www)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          const newMethod = (res.statusCode === 307 || res.statusCode === 308) ? method : 'GET';
          const newData = (res.statusCode === 307 || res.statusCode === 308) ? data : null;
          return makeRequest(redirectUrl, newMethod, newData, redirectCount + 1).then(resolve).catch(reject);
        }

        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    // If local relative file
    if (fileUrl.startsWith('/uploads/')) {
      fileUrl = CONFIG.serverUrl + fileUrl;
    }

    try {
      const parsedUrl = new URL(fileUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const file = fs.createWriteStream(destPath);
      client.get(fileUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          file.close();
          fs.unlinkSync(destPath);
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Virtual printer detection (filters out OneNote, PDF printers, Fax, etc.)
function isVirtualPrinter(p) {
  const text = `${p.Name || ''} ${p.DriverName || ''} ${p.PortName || ''}`.toLowerCase();
  const virtualTokens = [
    'onenote',
    'print to pdf',
    'microsoft print to pdf',
    'xps',
    'fax',
    'pdf printer',
    'adobe pdf',
    'foxit',
    'cuteftp',
    'send to',
    'nul:',
    'portprompt:'
  ];
  return virtualTokens.some(token => text.includes(token));
}

// 1. Detect Installed Windows Hardware Printers
function detectWindowsPrinters() {
  return new Promise((resolve) => {
    const cmd = 'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, Duplex, Color | ConvertTo-Json"';
    exec(cmd, { windowsHide: true }, (error, stdout) => {
      if (error) {
        log('Could not query PowerShell Get-Printer:', error.message);
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout);
        const rawList = Array.isArray(parsed) ? parsed : [parsed];
        
        // Filter out virtual printers so only real hardware printers are registered
        const physical = rawList.filter(p => !isVirtualPrinter(p));
        const list = physical.length > 0 ? physical : rawList;

        log(`✅ Detected ${list.length} physical Windows printer(s):`);
        list.forEach(p => {
          log(`   • ${p.Name} [Driver: ${p.DriverName}]`);
        });
        resolve(list);
      } catch (err) {
        resolve([]);
      }
    });
  });
}

// 2. Sync Real Detected Printers to Cloud
async function syncPrintersToCloud(printers) {
  if (!printers || printers.length === 0) return;
  try {
    const url = `${CONFIG.serverUrl}/api/agent/sync-printers`;
    const res = await makeRequest(url, 'POST', {
      shopSlug: CONFIG.shopSlug,
      printers: printers
    });
    if (res.status === 200) {
      log(`✅ Hardware printers synced with cloud for shop "${CONFIG.shopSlug}"!`);
    } else {
      log(`⚠️ Cloud sync responded with status ${res.status}`);
    }
  } catch (err) {
    log('⚠️ Cloud sync note:', err.message);
  }
}

// 3. Silent Print PDF via Windows Spooler (SumatraPDF native silent engine)
async function printJob(order, filePath, printerName) {
  return new Promise((resolve) => {
    const copies = Math.max(1, order.copies || 1);
    const target = printerName && printerName !== 'Default' ? printerName : 'Windows Default Printer';
    log(`🖨️ [SPOOLER] Spooling "${order.fileName}" -> "${target}" (${copies} ${copies === 1 ? 'copy' : 'copies'}, ${order.isDuplex ? 'Duplex' : 'Single'}, ${order.colorMode || 'BW'})...`);

    // Search for SumatraPDF in all candidate directories
    const candidatePaths = [
      path.join(baseDir, 'SumatraPDF.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'PagePrint', 'SumatraPDF.exe'),
      'C:\\Users\\zppsc\\AppData\\Local\\PagePrint\\SumatraPDF.exe',
      path.join(baseDir, 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe')
    ];
    const sumatraPath = candidatePaths.find(p => fs.existsSync(p));

    const cleanupAndResolve = () => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          log('   🔒 Local temporary file permanently wiped for privacy.');
        }
      } catch (e) {}
      resolve(true);
    };

    if (sumatraPath) {
      const printSettings = ['shrink', 'fit'];
      if (copies > 1) printSettings.push(`${copies}x`);
      if (order.isDuplex) {
        printSettings.push('duplexlong');
      } else {
        printSettings.push('simplex');
      }
      if (order.colorMode === 'COLOR') {
        printSettings.push('color');
      } else {
        printSettings.push('monochrome');
      }
      if (order.paperSize) {
        printSettings.push(`paper=${order.paperSize}`);
      }

      const settingsArg = `-print-settings "${printSettings.join(',')}"`;
      const printerArg = (printerName && printerName !== 'Default')
        ? `-print-to "${printerName}"`
        : `-print-to-default`;

      const sumatraCmd = `"${sumatraPath}" ${printerArg} -silent ${settingsArg} "${filePath}"`;

      exec(sumatraCmd, { windowsHide: true }, (err) => {
        if (err) {
          log('   ⚠️ Spooler notice:', err.message);
        } else {
          log(`   ✓ Successfully spooled ${copies} ${copies === 1 ? 'copy' : 'copies'} silently to ${target}!`);
        }
        cleanupAndResolve();
      });
    } else {
      // Fallback: PowerShell raw spool without opening GUI PDF viewer dialogs
      const safeFilePath = filePath.replace(/'/g, "''");
      const printerParam = (!printerName || printerName === 'Default')
        ? "(Get-CimInstance Win32_Printer -Filter 'Default = True').Name"
        : `'${printerName.replace(/'/g, "''")}'`;

      const psScript = `
        Add-Type -AssemblyName System.Drawing
        1..${copies} | ForEach-Object {
          $p = ${printerParam}
          Start-Process -FilePath '${safeFilePath}' -Verb PrintTo -ArgumentList $p -WindowStyle Hidden | Out-Null
        }
      `;
      const psCommand = `powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n\s*/g, ' ')}"`;

      exec(psCommand, { windowsHide: true }, (err) => {
        if (err) {
          log('   ⚠️ Spooler command notice:', err.message);
        } else {
          log(`   ✓ Handed off ${copies} ${copies === 1 ? 'copy' : 'copies'} to Windows Spooler`);
        }
        cleanupAndResolve();
      });
    }
  });
}

// 4. Queue Processing Loop
let isProcessingQueue = false;
let isFirstCheckAfterStartup = true;

async function checkAndProcessQueue(printers) {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const queueUrl = `${CONFIG.serverUrl}/api/agent/queue?shopSlug=${encodeURIComponent(CONFIG.shopSlug)}`;
    const res = await makeRequest(queueUrl, 'GET');

    if (res.status === 200 && res.data && Array.isArray(res.data.orders) && res.data.orders.length > 0) {
      // Outage Recovery: If agent just booted up / reconnected, any unfinished PRINTING jobs were interrupted.
      if (isFirstCheckAfterStartup) {
        isFirstCheckAfterStartup = false;
        for (const order of res.data.orders) {
          log(`\n⚠️ [OUTAGE DETECTED] Token #${order.tokenNumber} was interrupted by power or internet outage.`);
          log(`   Holding on dashboard for shopkeeper to click "Resume Print" (auto-cancels in 10 mins).`);
          try {
            await makeRequest(`${CONFIG.serverUrl}/api/agent/queue`, 'POST', {
              orderId: order.id,
              status: 'HELD_FOR_CONFIRMATION',
              heldAt: new Date().toISOString()
            });
          } catch (e) {}
        }
        return;
      }
      isFirstCheckAfterStartup = false;

      for (const order of res.data.orders) {
        log(`\n⚡ [NEW JOB] Token #${order.tokenNumber} | ${order.fileName} (${order.effectivePageCount} pages, ${order.colorMode})`);

        // Filter valid printers and exclude virtual ones
        const validPrinters = printers.filter(p => !isVirtualPrinter(p));
        const activeList = validPrinters.length > 0 ? validPrinters : printers;

        // Universal brand-agnostic printer routing (HP, Canon, Epson, Brother, Ricoh, Xerox, Kyocera, etc.)
        let targetPrinter = order.targetPrinterName;
        if (!targetPrinter || isVirtualPrinter({ Name: targetPrinter }) || !activeList.find(p => p.Name === targetPrinter)) {
          // If only 1 physical printer exists on this machine, route all jobs (Color & BW) to it!
          if (activeList.length === 1) {
            targetPrinter = activeList[0].Name;
          } else if (order.colorMode === 'COLOR') {
            // Find any color capable printer across all brands
            const isColorCapable = (p) => {
              const str = `${p.Name || ''} ${p.DriverName || ''}`.toLowerCase();
              return Boolean(p.Color) || str.includes('color') || str.includes('colour') || str.includes('ink') || str.includes('tank') || str.includes('deskjet') || str.includes('pixma');
            };
            const cp = activeList.find(p => isColorCapable(p));
            targetPrinter = cp ? cp.Name : activeList[0].Name;
          } else {
            // For B&W: Prefer a dedicated monochrome laser printer if present, else first physical printer
            const isMono = (p) => {
              const str = `${p.Name || ''} ${p.DriverName || ''}`.toLowerCase();
              return (!p.Color && !str.includes('color') && !str.includes('colour')) && (str.includes('laser') || str.includes('mono') || str.includes('dcp') || str.includes('lbp') || str.includes('m1') || str.includes('1020') || str.includes('2900'));
            };
            const bwp = activeList.find(p => isMono(p));
            targetPrinter = bwp ? bwp.Name : activeList[0].Name;
          }
        }

        // Download front / primary file
        const tempFileName = `job_${order.tokenNumber}_${Date.now()}.pdf`;
        const localTempPath = path.join(CONFIG.tempDir, tempFileName);

        try {
          await downloadFile(order.fileUrl, localTempPath);
          await printJob(order, localTempPath, targetPrinter);

          // If ID card back file exists
          if (order.backFileUrl) {
            const tempBackFileName = `job_${order.tokenNumber}_back_${Date.now()}.pdf`;
            const localBackTempPath = path.join(CONFIG.tempDir, tempBackFileName);
            await downloadFile(order.backFileUrl, localBackTempPath);
            await printJob(order, localBackTempPath, targetPrinter);
          }

          // Notify Cloud Server to mark as PRINTED and wipe Cloudinary document
          await makeRequest(`${CONFIG.serverUrl}/api/agent/queue`, 'POST', {
            orderId: order.id,
            status: 'PRINTED',
            publicId: order.publicId,
            fileUrl: order.fileUrl,
            backPublicId: order.backPublicId,
            backFileUrl: order.backFileUrl
          });
          log(`✅ Token #${order.tokenNumber} marked PRINTED in cloud. All documents permanently deleted.\n`);
        } catch (jobErr) {
          log(`❌ Failed to print order ${order.id}:`, jobErr.message);
        }
      }
    }
  } catch (err) {
    // Silent fail on momentary network hiccups
  } finally {
    isProcessingQueue = false;
  }
}

// 5. Main Lifecycle
async function start() {
  log('========================================================');
  log('       PagePrint Windows Auto-Print Desktop Agent       ');
  log('========================================================');
  await promptShopSlug();

  log(`Shop Slug:    ${CONFIG.shopSlug}`);
  log(`Server Host:  ${CONFIG.serverUrl}`);
  log(`Spool Dir:    ${CONFIG.tempDir}`);
  log('--------------------------------------------------------');

  const printers = await detectWindowsPrinters();
  try {
    await syncPrintersToCloud(printers);
  } catch (syncErr) {}

  log(`⚡ Agent is LIVE & listening for orders on ${CONFIG.serverUrl}...`);
  log('Zero-click printing active. Press Ctrl+C to stop.\n');

  // Immediately check queue once, then every poll interval
  checkAndProcessQueue(printers);
  setInterval(() => {
    checkAndProcessQueue(printers);
  }, CONFIG.pollIntervalMs);
}

start();
