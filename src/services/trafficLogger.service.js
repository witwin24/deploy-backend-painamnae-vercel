const prisma = require('../utils/prisma');
const { utcToThai } = require('../utils/timezone');

const getTrafficLogs = async ({ 
    startDate, 
    endDate, 
    userId, 
    method, 
    statusCode, 
    page = 1, 
    limit = 20 
}) => {
    const where = {};

    if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = utcToThai(startDate);
        if (endDate)   where.timestamp.lte = utcToThai(endDate);
    }

    if (userId)     where.userId     = userId;
    if (method)     where.method     = method.toUpperCase();
    if (statusCode) where.statusCode = parseInt(statusCode);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
        prisma.trafficLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            skip,
            take: parseInt(limit),
        }),
        prisma.trafficLog.count({ where }),
    ]);

    return {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        data: logs,
    };
};

module.exports = { getTrafficLogs };