import { spawn } from "node:child_process";

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function showToast(title: string, message: string): Promise<void> {
  if (process.platform !== "win32") return Promise.resolve();
  const xml = `<toast><visual><binding template="ToastGeneric"><text>${escape(title)}</text><text>${escape(message)}</text></binding></visual></toast>`;
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml(@'
${xml}
'@)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Painel de Postagens')
$notification = New-Object Windows.UI.Notifications.ToastNotification $xml
$notifier.Show($notification)
`;
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { stdio: "ignore", windowsHide: true }
    );
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}
