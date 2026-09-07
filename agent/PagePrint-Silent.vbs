Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

If fso.FileExists(currentDir & "\PagePrint.exe") Then
    WshShell.Run Chr(34) & currentDir & "\PagePrint.exe" & Chr(34), 0, False
Else
    WshShell.Run "node index.js", 0, False
End If
