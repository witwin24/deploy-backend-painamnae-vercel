const prisma = require('../utils/prisma');

const { nowThai } = require('../utils/timezone');


const trafficLogger = (req, res, next) => { 
    res.on('finish', async () => {
        try {
            const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '-';
            const sourceIp = rawIp.split(',')[0].trim();
            const sourcePort = req.socket.remotePort?.toString() || '-';

            const destinationUrl = `${req.protocol}://${req.headers['host']}${req.originalUrl}`;
            const destinationPort = req.socket.localPort?.toString() || (req.protocol === 'https' ? '443' : '80');

            const logData = {
                timestamp:       nowThai(),
                sourceIp:        sourceIp,
                sourcePort:      sourcePort,
                destinationUrl:  destinationUrl,
                destinationPort: destinationPort,
                userId:          req.user ? req.user.sub : '-',
                userAgent:       req.headers['user-agent'] || '-',
                method:          req.method,
                protocol:        req.protocol.toUpperCase(),
                statusCode:      res.statusCode,
                action:          `${req.method} ${req.originalUrl} → ${res.statusCode}`,
            };

            await prisma.trafficLog.create({ data: logData });

        } catch (error) {
            console.error('[TrafficLog] Error:', error.message);
        }
    });

    next();
};

module.exports = trafficLogger;