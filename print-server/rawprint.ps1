param($PrinterName, $FilePath)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFO {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO pDocInfo);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$handle = [IntPtr]::Zero

if (-not [RawPrinter]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
    Write-Error "Falha ao abrir impressora"
    exit 1
}

$doc = New-Object RawPrinter+DOCINFO
$doc.pDocName = "Pedido"
$doc.pDataType = "RAW"

if (-not [RawPrinter]::StartDocPrinter($handle, 1, [ref]$doc)) {
    Write-Error "Falha ao iniciar documento"
    exit 1
}

if (-not [RawPrinter]::StartPagePrinter($handle)) {
    Write-Error "Falha ao iniciar pagina"
    exit 1
}

$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)

$written = 0
if (-not [RawPrinter]::WritePrinter($handle, $ptr, $bytes.Length, [ref]$written)) {
    Write-Error "Falha ao escrever na impressora"
    exit 1
}

[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrinter]::EndPagePrinter($handle) | Out-Null
[RawPrinter]::EndDocPrinter($handle) | Out-Null
[RawPrinter]::ClosePrinter($handle) | Out-Null

Write-Output "OK:$written"
