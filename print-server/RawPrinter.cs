using System;
using System.IO;
using System.Runtime.InteropServices;

class RawPrinter {
  [DllImport("winspool.drv", CharSet=CharSet.Unicode)]
  static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.drv")]
  static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOA di);

  [DllImport("winspool.drv")]
  static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv")]
  static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  [DllImport("winspool.drv")]
  static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv")]
  static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv")]
  static extern bool ClosePrinter(IntPtr hPrinter);

  struct DOCINFOA {
    public string pDocName;
    public string pOutputFile;
    public string pDataType;
  }

  static int Main(string[] args) {
    if (args.Length < 2) { Console.Error.WriteLine("Usage: RawPrinter <file> <printer>"); return 1; }

    string file = args[0];
    string printer = args[1];
    if (!File.Exists(file)) { Console.Error.WriteLine("File not found: " + file); return 2; }

    byte[] data = File.ReadAllBytes(file);
    IntPtr hPrinter = IntPtr.Zero;

    if (!OpenPrinter(printer, out hPrinter, IntPtr.Zero)) {
      Console.Error.WriteLine("OpenPrinter failed: " + printer);
      return 3;
    }

    try {
      var di = new DOCINFOA { pDocName = "Receipt", pDataType = "RAW" };
      if (!StartDocPrinter(hPrinter, 1, ref di)) {
        Console.Error.WriteLine("StartDocPrinter failed");
        return 4;
      }
      if (!StartPagePrinter(hPrinter)) {
        Console.Error.WriteLine("StartPagePrinter failed");
        return 5;
      }
      int written = 0;
      if (!WritePrinter(hPrinter, data, data.Length, out written)) {
        Console.Error.WriteLine("WritePrinter failed (written=" + written + ")");
        return 6;
      }
      EndPagePrinter(hPrinter);
      EndDocPrinter(hPrinter);
      Console.WriteLine("OK:" + written);
      return 0;
    } finally {
      if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
    }
  }
}
