go build -o octavia-server.exe .\cmd\server\
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
.\octavia-server.exe
