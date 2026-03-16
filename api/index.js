const app = require("../server"); // path ไปไฟล์ express หลัก
app.get("/", (req, res) => {
  res.json({ message: "API running" });
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
module.exports = app;