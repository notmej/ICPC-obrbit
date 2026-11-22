import { app, BrowserWindow, Notification, shell } from 'electron';
import http from 'node:http';
let mainWindow:BrowserWindow|null=null;
let server: http.Server | undefined;
let notificationInterval: NodeJS.Timeout | undefined;
let shuttingDown=false;
async function endFocusOnClose() {
  try { await fetch(`http://127.0.0.1:${port}/api/study/stop`,{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(1800)}); } catch { /* API may already be offline */ }
}
const port=Number(process.env.PORT||4618);
const development=process.argv.includes('--dev');
function openWindow() {
  mainWindow=new BrowserWindow({
    width:1540,height:1000,minWidth:1050,minHeight:720,
    backgroundColor:'#070d17',title:'ICPC Orbit',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return {action:'deny'};
  });
  void mainWindow.loadURL(development?'http://127.0.0.1:5173':`http://127.0.0.1:${port}`);
  mainWindow.on('close',()=>{if(process.platform==='darwin')void endFocusOnClose();});
  mainWindow.on('closed',()=>mainWindow=null);
}
async function checkContestReminders() {
  try {
    const response=await fetch(`http://127.0.0.1:${port}/api/contests/due`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    if (!response.ok) return;
    const due=await response.json() as Array<{id:number,name:string,startSeconds:number}>;
    for (const c of due) if (Notification.isSupported()) {
      const minutes=Math.max(0,Math.ceil((c.startSeconds-Date.now()/1000)/60));
      new Notification({title:'⚡ Codeforces contest soon',body:`${c.name} starts in ${minutes} minutes.`}).show();
    }
  } catch { /* offline: try next minute */ }
}
async function run() {
  if (!development) {
    try {
      const api=require('../../server/dist/index.js') as {startServer:()=>Promise<http.Server>};
      server=await api.startServer();
    } catch (e) {
      console.error('MySQL unavailable:',e);
      const dialog=require('electron').dialog;
      dialog.showErrorBox('ICPC Orbit: MySQL unavailable',
        'Start Docker Desktop, then run "docker compose up -d" from the ICPC Orbit project folder.\n\n'+String(e));
      app.quit();return;
    }
  }
  openWindow();
  void checkContestReminders();
  notificationInterval=setInterval(()=>void checkContestReminders(),60_000);
}
app.whenReady().then(run);
app.on('window-all-closed',()=>{ if(process.platform!=='darwin') app.quit(); });
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)openWindow();});
app.on('before-quit',(event)=>{
  if(shuttingDown)return;
  event.preventDefault();
  shuttingDown=true;
  if(notificationInterval)clearInterval(notificationInterval);
  void endFocusOnClose().finally(()=>{if(server)server.close();app.quit();});
});
