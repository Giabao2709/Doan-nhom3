const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./admin_module.db');

db.serialize(() => {
    // Tạo bảng lưu trữ thông tin tài khoản người dùng
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        email TEXT,
        role TEXT,
        status INTEGER DEFAULT 1 -- 1: Hoạt động, 0: Bị khóa
    )`);

    // Tự động chèn tài khoản Admin mẫu nếu chưa tồn tại trong hệ thống
    db.run(`INSERT OR IGNORE INTO users (username, password, full_name, email, role, status) 
            VALUES ('admin', 'admin123', 'Quản trị viên hệ thống', 'admin@congty.com', 'Admin', 1)`);
    
    // Xóa bảng cũ (nếu có) để cập nhật cấu trúc mới
    db.run(`DROP TABLE IF EXISTS meetings`); 

    // Tạo bảng cuộc họp phiên bản nâng cao
    db.run(`CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_date TEXT, -- Định dạng chuẩn: YYYY-MM-DD
        room_name TEXT,
        booked_by TEXT
    )`);

    // Chèn dữ liệu giả lập (Mock Data) để có ngay biểu đồ và chi tiết để xem
    db.run(`INSERT INTO meetings (meeting_date, room_name, booked_by) VALUES 
        ('2026-07-06', 'Phòng Họp A', 'Trần Gia Bảo'),
        ('2026-07-06', 'Phòng Họp B', 'Nguyễn Văn A'),
        ('2026-07-07', 'Phòng Họp A', 'Trần Nhật Khoa'),
        ('2026-07-08', 'Phòng Họp C', 'Trương Đức Thành'),
        ('2026-07-08', 'Phòng Họp B', 'Trần Gia Bảo'),
        ('2026-07-08', 'Phòng Họp A', 'Nguyễn Văn A'),
        ('2026-07-09', 'Phòng Họp VIP', 'Trần Nhật Khoa'),
        ('2026-08-15', 'Phòng Họp A', 'Nguyễn Văn A'),
        ('2027-01-10', 'Phòng Hội Trường', 'Trần Gia Bảo')
    `);
});

console.log("-> Cơ sở dữ liệu SQLite đã sẵn sàng phục vụ US-01!");
module.exports = db;