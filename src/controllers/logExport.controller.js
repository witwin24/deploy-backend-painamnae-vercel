const { getExportLogs, createExportAuditLog } = require('../services/logExport.service');

const exportLogs = async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        const logs = await getExportLogs({ startDate, endDate });

        return res.status(200).json({
            success: true,
            total:   logs.length,
            data:    logs,
        });

    } catch (error) {
        console.error('[ExportLog Error]', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const createExportLog = async (req, res) => {
    const { startDate, endDate, rowCount, securityMeasure } = req.body;

    const adminId       = req.user?.sub;
    const adminUsername = req.user?.username || null;
    const adminRole     = req.user?.role;
    const ipAddress     = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const userAgent     = req.headers['user-agent'] || null;

    if (!adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const auditLog = await createExportAuditLog({
            adminId,
            adminUsername,
            adminRole,
            ipAddress,
            userAgent,
            startDate:       startDate       || null,
            endDate:         endDate         || null,
            rowCount:        rowCount ? parseInt(rowCount) : null,
            securityMeasure: securityMeasure || null,
        });

        return res.status(201).json({
            success: true,
            message: 'บันทึกประวัติการ Export สำเร็จ',
            data:    auditLog,
        });

    } catch (error) {
        console.error('[CreateExportLog Error]', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = { exportLogs, createExportLog };