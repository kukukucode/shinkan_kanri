$REMOTE_URL = "https://github.com/kosukekuwaha-sketch/shinkan_kanri.git"

Write-Host "=== Git Setup Start ===" -ForegroundColor Cyan

Write-Host "[1/5] git init..." -ForegroundColor Yellow
git init

Write-Host "[2/5] Setting remote..." -ForegroundColor Yellow
$remoteExists = git remote get-url origin 2>$null
if ($remoteExists) {
    git remote set-url origin $REMOTE_URL
} else {
    git remote add origin $REMOTE_URL
}

Write-Host "[3/5] Staging files..." -ForegroundColor Yellow
git add index.html style.css script.js

Write-Host "[4/5] Committing..." -ForegroundColor Yellow
git commit -m "Apple-style participant dashboard - initial commit"

Write-Host "[5/5] Pushing to GitHub..." -ForegroundColor Yellow
git branch -M main
git push -u origin main

Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host $REMOTE_URL -ForegroundColor Cyan
