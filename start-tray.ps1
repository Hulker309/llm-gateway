# LLM Gateway Tray Launcher
$gatewayDir = "D:\Game and Files\develop\mcp-tools\llm-gateway"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$gatewayJs = "$gatewayDir\index.js"

# Kill old gateway on port 3456
$oldPid = netstat -ano | findstr ":3456 " | findstr LISTENING
if ($oldPid) { taskkill /f /pid ($oldPid -split '\s+')[-1] 2>$null }

# Start gateway hidden
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $nodeExe
$pinfo.Arguments = "`"$gatewayJs`""
$pinfo.WorkingDirectory = $gatewayDir
$pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$pinfo.UseShellExecute = $true
$gateway = [System.Diagnostics.Process]::Start($pinfo)

Start-Sleep -Seconds 2
Start-Process "http://localhost:3456"

# Tray icon using .NET
Add-Type -AssemblyName System.Windows.Forms
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Text = "LLM Gateway - http://localhost:3456"
$tray.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($nodeExe)
$tray.Visible = $true

$tray.Add_DoubleClick({ Start-Process "http://localhost:3456" })

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$item1 = New-Object System.Windows.Forms.ToolStripMenuItem("Open Admin")
$item1.Add_Click({ Start-Process "http://localhost:3456" })
$menu.Items.Add($item1) | Out-Null

$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

$item2 = New-Object System.Windows.Forms.ToolStripMenuItem("Exit")
$item2.Add_Click({
    $tray.Visible = $false
    $gateway.Kill()
    [System.Windows.Forms.Application]::Exit()
})
$menu.Items.Add($item2) | Out-Null

$tray.ContextMenuStrip = $menu
[System.Windows.Forms.Application]::Run()
