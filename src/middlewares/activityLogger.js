const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prisma');


// กำหนด Timezone เป็น UTC+7 (ประเทศไทย)
const THAI_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;

const activityLogger = asyncHandler(async (req, res, next) => {
    // ดักฟัง 'finish' 
    res.on('finish', async () => {
        try {
            
            // คำนวณเวลาปัจจุบันใน Timezone ของประเทศไทย
            const now = new Date();
            const thaiTimeDate = new Date(now.getTime() + THAI_TIME_OFFSET_MS);

            // เก็บข้อมูลตามความต้องการของ Admin
            const logData = {
               user: req.user ? req.user.sub : '-', // ข้อมูล sub จาก jwt
               method: req.method,                  // GET, POST, DELETE
               endpoint: req.originalUrl,           // /api/bookings/me
                status: res.statusCode,              // 200, 401, 400
                userAgent: req.headers['user-agent'] || null,
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                timestamp: thaiTimeDate 
            };
            //console.log(`[Activity Log] User: ${req.user ? req.user.sub : '-'} | Method: ${req.method} | Endpoint: ${req.originalUrl} | Status: ${res.statusCode} | IP: ${logData.ip} | UserAgent: ${req.headers['user-agent'] || null}`);
            // บันทึกลงตาราง ActivityLog ใน Database
           await prisma.activityLog.create({
                data: logData
            });

        } catch (error) {
            console.error('Error recording activity log:', error);
        }
    });

    next();
});

module.exports = activityLogger;