Set WshShell = CreateObject("WScript.Shell")
' 0 = Hide window (Runs silently in background)
WshShell.Run "cmd /c """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\run_mkt_scheduler.bat""", 0, False
