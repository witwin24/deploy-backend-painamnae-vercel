const prisma = require('../utils/prisma');

const getExportLogs = async ({ startDate, endDate } = {}) => {
    const where = {};

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate)   where.createdAt.lte = new Date(endDate);
    }

    return await prisma.logExportAdmin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });
};

const createExportAuditLog = async ({
    adminId,
    adminUsername,
    adminRole,
    ipAddress,
    userAgent,
    startDate,
    endDate,
    rowCount,
    securityMeasure,
}) => {
    const retentionDays = 90;
    const expiresAt     = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    return await prisma.logExportAdmin.create({
        data: {
            adminId,
            adminUsername,
            adminRole,
            ipAddress,
            userAgent,
            exportedDataType: 'Traffic Log',
            dataScope:        startDate && endDate ? `Log ตั้งแต่ ${startDate} ถึง ${endDate}` : 'Log ทั้งหมด',
            fileFormat:       'JSON',
            rowCount,
            securityMeasure,
            retentionDays,
            expiresAt,
        },
    });
};

module.exports = { getExportLogs, createExportAuditLog };