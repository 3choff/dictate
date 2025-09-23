// Native Windows text injection using a persistent hidden PowerShell process
// that listens on stdin and calls System.Windows.Forms.SendKeys.SendWait for each line.
// This avoids per-injection process spawn overhead and is significantly faster.

const { spawn } = require('child_process');

let psProc = null;
let ready = false;

function escapeForSendKeys(input) {
  // Escape characters that have special meaning in SendKeys
  // - Braces must be doubled
  // - Special chars + ^ % ~ ( ) should be wrapped in braces
  // - Newlines should be converted to {ENTER}
  // Ref: https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.sendkeys
  let s = String(input).replace(/\r\n/g, '\n'); // normalize newlines

  s = s
    .replace(/\{/g, '{{}')
    .replace(/\}/g, '{}}')
    .replace(/\+/g, '{+}')
    .replace(/\^/g, '{^}')
    .replace(/%/g, '{%}')
    .replace(/~/g, '{~}')
    .replace(/\(/g, '{(}')
    .replace(/\)/g, '{)}')
    .replace(/\n/g, '{ENTER}');

  return s;
}

function startNativeInjector() {
  if (psProc) return;

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    "$in = [Console]::In",
    'while ($true) {',
    '  $line = $in.ReadLine()',
    '  if ($null -eq $line) { break }',
    '  [System.Windows.Forms.SendKeys]::SendWait($line)',
    '}',
  ].join('; ');

  psProc = spawn('powershell.exe', [
    '-NoProfile',
    '-WindowStyle', 'Hidden',
    '-ExecutionPolicy', 'Bypass',
    '-Command', script,
  ], { windowsHide: true });

  ready = true;

  psProc.on('exit', () => {
    psProc = null;
    ready = false;
  });
}

function stopNativeInjector() {
  if (psProc) {
    try { psProc.stdin.end(); } catch (_) {}
    try { psProc.kill(); } catch (_) {}
    psProc = null;
    ready = false;
  }
}

function injectTextNative(text) {
  if (!ready) startNativeInjector();
  const payload = escapeForSendKeys(text) + '\n';
  return new Promise((resolve, reject) => {
    if (!psProc || !psProc.stdin) return reject(new Error('Native injector not available'));
    psProc.stdin.write(payload, (err) => {
      if (err) return reject(err);
      // SendWait blocks within PowerShell; we cannot easily know when it finishes here.
      // For our purposes, writing successfully is sufficient.
      resolve();
    });
  });
}

module.exports = {
  startNativeInjector,
  stopNativeInjector,
  injectTextNative,
};
