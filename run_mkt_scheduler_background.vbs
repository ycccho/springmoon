Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\my\springmoon"
WshShell.Run """C:\Users\whdyd\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe"" -m mkt_scheduler.main_scheduler", 0, False
