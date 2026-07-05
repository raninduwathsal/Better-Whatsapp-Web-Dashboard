# Run Better WhatsApp Web Dashboard
Write-Host "Updating dependencies..."
npm install
npm update

Write-Host "Starting Better WhatsApp Web Dashboard..."
npm start

# Pause if the app crashes or stops so the user can see the error
if ($LASTEXITCODE -ne 0) {
    Write-Host "The application exited with an error code ($LASTEXITCODE)."
    Pause
}
