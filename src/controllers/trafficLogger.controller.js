const asyncHandler = require('express-async-handler');
const trafficLogService = require('../services/trafficLogger.service');
const crypto = require('crypto');
const archiver = require("archiver");

const getTrafficLogs = asyncHandler(async (req, res) => {
    const { startDate, endDate, userId, method, statusCode, page, limit } = req.query;

    const result = await trafficLogService.getTrafficLogs({
        startDate,
        endDate,
        userId,
        method,
        statusCode,
        page,
        limit,
    });

    res.status(200).json({
        success: true,
        ...result,
    });
});

const exportTrafficLogs = asyncHandler(async (req, res) => {
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
    }

    const { startDate, endDate, userId, method, statusCode } = req.query;

    const logs = await trafficLogService.getTrafficLogs({
        startDate,
        endDate,
        userId,
        method,
        statusCode,
        page: 1,
        limit: 1000000,
    });

    const jsonData = JSON.stringify(logs.data || logs, null, 2);

    // SHA256
    const hash = crypto.createHash("sha256").update(jsonData).digest("hex");

    const baseName = `traffic_logs_${Date.now()}`;

    const jsonFile = `${baseName}.json`;
    const shaFile = `${baseName}.json.sha256`;

    const shaContent = `${hash}  ${jsonFile}`;

    // verify script
    const verifyScript = `@echo off
title Traffic Log Integrity Checker

echo ======================================
echo   TRAFFIC LOG SHA256 VERIFY TOOL
echo ======================================
echo.

set jsonFile=
set shaFile=

for %%f in (*.json) do set jsonFile=%%f
for %%f in (*.sha256) do set shaFile=%%f

if "%jsonFile%"=="" (
echo JSON file not found
pause
exit
)

if "%shaFile%"=="" (
echo SHA256 file not found
pause
exit
)

echo JSON FILE : %jsonFile%
echo HASH FILE : %shaFile%
echo.

powershell -Command ^
"$expected=(Get-Content '%shaFile%').Split(' ')[0].Trim(); ^
$actual=(Get-FileHash '%jsonFile%' -Algorithm SHA256).Hash.ToLower(); ^
Write-Host 'Expected Hash :' $expected; ^
Write-Host 'Actual Hash   :' $actual; ^
if($expected -eq $actual){Write-Host '';Write-Host 'VALID FILE (No modification)' -ForegroundColor Green}else{Write-Host '';Write-Host 'FILE TAMPERED!' -ForegroundColor Red}"

echo.
pause
`;

    const zipName = `${baseName}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${zipName}`);

    const archive = archiver("zip", {
        zlib: { level: 9 },
    });

    archive.pipe(res);

    // add files
    archive.append(jsonData, { name: jsonFile });
    archive.append(shaContent, { name: shaFile });
    archive.append(verifyScript, { name: "verify-log.bat" });

    await archive.finalize();
});

module.exports = { getTrafficLogs, exportTrafficLogs };