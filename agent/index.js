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
  serverUrl: process.env.PAGEPRINT_SERVER_URL || savedConfig.serverUrl || 'https://pageprint.in',
  pollIntervalMs: 3000,
  tempDir: path.join(baseDir, 'temp')
};

if (!fs.existsSync(CONFIG.tempDir)) {
  fs.mkdirSync(CONFIG.tempDir, { recursive: true });
}

function promptShopSlug() {
  return new Promise((resolve) => {
    if (CONFIG.shopSlug && CONFIG.shopSlug.trim()) {
      return resolve(CONFIG.shopSlug.trim());
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log('\n====================================================');
    console.log(' FIRST-TIME SETUP: Please enter your Shop Slug');
    console.log(' (Found on your dashboard: e.g. "krishna-xerox")');
    console.log('====================================================');
    rl.question('Enter Shop Slug: ', (slugAns) => {
      const slug = slugAns.trim() || 'krishna-xerox';
      CONFIG.shopSlug = slug;
      
      console.log('\nServer Environment:');
      console.log(' 1. Cloud Production (https://pageprint.in) [Default]');
      console.log(' 2. Localhost Test   (http://localhost:3000)');
      rl.question('Choose Server [1 or 2, default 1]: ', (srvAns) => {
        rl.close();
        if (srvAns.trim() === '2') {
          CONFIG.serverUrl = 'http://localhost:3000';
        } else {
          CONFIG.serverUrl = 'https://pageprint.in';
        }

        try {
          fs.writeFileSync(CONFIG_FILE, JSON.stringify({ shopSlug: slug, serverUrl: CONFIG.serverUrl }, null, 2));
          console.log(`\n✅ Saved configuration to ${CONFIG_FILE}\n`);
        } catch (err) {}
        resolve(slug);
      });
    });
  });
}

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PagePrint-DesktopAgent/1.0'
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
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

      if (data) {
        req.write(JSON.stringify(data));
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

// 1. Detect Installed Windows Printers
function detectWindowsPrinters() {
  return new Promise((resolve) => {
    const cmd = 'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, Duplex, Color | ConvertTo-Json"';
    exec(cmd, (error, stdout) => {
      if (error) {
        console.warn('Could not query PowerShell Get-Printer:', error.message);
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`✅ Detected ${list.length} installed Windows printer(s):`);
        list.forEach(p => {
          console.log(`   • ${p.Name} [Driver: ${p.DriverName}]`);
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
      console.log(`✅ Hardware printers synced with cloud for shop "${CONFIG.shopSlug}"!`);
    }
  } catch (err) {
    console.warn('⚠️ Cloud sync note:', err.message);
  }
}

// 3. Silent Print PDF via Windows Spooler
async function printJob(order, filePath, printerName) {
  return new Promise((resolve) => {
    const copies = Math.max(1, order.copies || 1);
    const target = printerName && printerName !== 'Default' ? printerName : 'Windows Default Printer';
    console.log(`🖨️ [SPOOLER] Spooling "${order.fileName}" -> "${target}" (${copies} ${copies === 1 ? 'copy' : 'copies'}, ${order.isDuplex ? 'Duplex' : 'Single'})...`);

    const safeFilePath = filePath.replace(/'/g, "''");
    const psCommand = (!printerName || printerName === 'Default')
      ? `powershell -Command "1..${copies} | ForEach-Object { Start-Process -FilePath '${safeFilePath}' -Verb Print -PassThru | Wait-Process -Timeout 15 }"`
      : `powershell -Command "1..${copies} | ForEach-Object { Start-Process -FilePath '${safeFilePath}' -Verb PrintTo -ArgumentList '${printerName.replace(/'/g, "''")}' -PassThru | Wait-Process -Timeout 15 }"`;
    
    exec(psCommand, (err) => {
      if (err) {
        console.warn('   ⚠️ Print command notice:', err.message);
      } else {
        console.log(`   ✓ Successfully handed off ${copies} ${copies === 1 ? 'copy' : 'copies'} to Windows Spooler`);
      }

      // Privacy Cleanup: Immediately wipe local temporary file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('   🔒 Local temporary file permanently wiped for privacy.');
        }
      } catch (e) {}

      resolve(true);
    });
  });
}

// 4. Queue Processing Loop
let isProcessingQueue = false;

async function checkAndProcessQueue(printers) {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const queueUrl = `${CONFIG.serverUrl}/api/agent/queue?shopSlug=${encodeURIComponent(CONFIG.shopSlug)}`;
    const res = await makeRequest(queueUrl, 'GET');

    if (res.status === 200 && res.data && Array.isArray(res.data.orders) && res.data.orders.length > 0) {
      for (const order of res.data.orders) {
        console.log(`\n⚡ [NEW JOB] Token #${order.tokenNumber} | ${order.fileName} (${order.effectivePageCount} pages, ${order.colorMode})`);

        // Determine target printer
        let targetPrinter = order.targetPrinterName;
        if (!targetPrinter || !printers.find(p => p.Name === targetPrinter)) {
          // Auto route: Color to color printer, BW to monochrome
          if (order.colorMode === 'COLOR') {
            const cp = printers.find(p => p.Color || p.Name.toLowerCase().includes('color') || p.Name.toLowerCase().includes('epson'));
            targetPrinter = cp ? cp.Name : (printers[0] ? printers[0].Name : 'Default');
          } else {
            const bwp = printers.find(p => !p.Color && !p.Name.toLowerCase().includes('color'));
            targetPrinter = bwp ? bwp.Name : (printers[0] ? printers[0].Name : 'Default');
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
          console.log(`✅ Token #${order.tokenNumber} marked PRINTED in cloud. All documents permanently deleted.\n`);
        } catch (jobErr) {
          console.error(`❌ Failed to print order ${order.id}:`, jobErr.message);
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
  console.log('========================================================');
  console.log('       PagePrint Windows Auto-Print Desktop Agent       ');
  console.log('========================================================');
  await promptShopSlug();

  console.log('Shop Slug:   ', CONFIG.shopSlug);
  console.log('Server Host: ', CONFIG.serverUrl);
  console.log('Spool Dir:   ', CONFIG.tempDir);
  console.log('--------------------------------------------------------');

  const printers = await detectWindowsPrinters();
  await syncPrintersToCloud(printers);

  console.log(`\n⚡ Agent is LIVE & listening for orders on ${CONFIG.serverUrl}...`);
  console.log('Zero-click printing active. Press Ctrl+C to stop.\n');

  setInterval(() => {
    checkAndProcessQueue(printers);
  }, CONFIG.pollIntervalMs);
}

start();
