@echo off
:: Run this as Administrator to open port 3001 in Windows Firewall
echo Opening port 3001 for Lost & Found Server...
netsh advfirewall firewall add rule name="Lost and Found Server Port 3001" dir=in action=allow protocol=TCP localport=3001
echo Done! Port 3001 is now open.
echo Your phone should now be able to connect to the server.
pause