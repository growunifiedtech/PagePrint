Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir
exePath = currentDir & "\PagePrint.exe"

If fso.FileExists(exePath) Then
    WshShell.Run Chr(34) & exePath & Chr(34), 0, False
Else
    MsgBox "PagePrint.exe was not found in:" & vbCrLf & currentDir & vbCrLf & vbCrLf & "Please extract all files from the ZIP or run Install-PagePrint-AutoStart.bat", vbCritical, "PagePrint Agent Error"
End If

