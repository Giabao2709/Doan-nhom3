const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());

// Chỉ định thư mục chứa file giao diện HTML
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// US-01: Đăng nhập hệ thống bảo mật
// =================================================================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    const sql = `SELECT id, username, full_name, role, status FROM users WHERE username = ? AND password = ?`;
                 
    db.get(sql, [username, password], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
        if (!row) return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
        
        // 1. Kiểm tra xem tài khoản có bị khóa không
        if (row.status === 0) {
            return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa quyền truy cập!" });
        }
 // 2. BỨC TƯỜNG BẢO MẬT: Chặn nhân viên vào trang Admin
        if (row.role !== 'Admin') {
            return res.status(403).json({ 
                success: false, 
                message: "Bạn là Nhân viên. Vui lòng dùng ứng dụng của Nhân viên để đăng nhập!" 
            });
        }

        // Nếu qua được hết các cửa trên (Không bị khóa VÀ là Admin) thì mới cho vào
        res.json({ 
            success: true, 
            message: "Đăng nhập quyền Admin thành công!",
            user: { username: row.username, name: row.full_name, role: row.role }
        });
    });
});
// =================================================================
// US-02 & US-03: Xem danh sách và Tìm kiếm nhân viên
// =================================================================
app.get('/api/users', (req, res) => {
    const keyword = req.query.keyword || '';
    
    const sql = `
        SELECT id, username, full_name, email, role, status 
        FROM users 
        WHERE (full_name LIKE ? OR username LIKE ?) 
        AND role = 'Employee'
    `;
    
    db.all(sql, [`%${keyword}%`, `%${keyword}%`], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Lỗi truy xuất dữ liệu từ hệ thống" });
        }
        res.json(rows);
    });
});


// =================================================================
// US-05 & US-06: KHÓA / MỞ KHÓA TÀI KHOẢN NHÂN VIÊN
// =================================================================
app.put('/api/users/:id/status', (req, res) => {
    const userId = req.params.id;
    const { status } = req.body;

    const sql = `UPDATE users SET status = ? WHERE id = ?`;
    
    db.run(sql, [status, userId], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: "Lỗi hệ thống, không thể cập nhật trạng thái!" });
        }
        
        const msg = status === 0 ? "Tài khoản nhân viên đã được khóa!" : "Tài khoản nhân viên đã được mở khóa thành công!";
        res.json({ success: true, message: msg });
    });
});

// =================================================================
// US-07 HOÀN HẢO: Biểu đồ lùi thời gian, lấp đầy ngày trống bằng 0
// =================================================================
app.get('/api/dashboard/stats', (req, res) => {
    const filter = req.query.filter || 'week';
    const reqDate = req.query.date; 

    // Lấy ngày mốc từ cái lịch nhỏ (nếu để trống thì tự lấy hôm nay)
    let refDate = reqDate ? new Date(reqDate + 'T12:00:00Z') : new Date(new Date().getTime() + (7 * 60 * 60 * 1000));

    let labels = [];
    let sql = '';
    let params = [];

    if (filter === 'week') {
        // Tự động đẻ ra mảng đúng 7 ngày lùi về quá khứ từ ngày được chọn
        for (let i = 6; i >= 0; i--) {
            const d = new Date(refDate);
            d.setDate(d.getDate() - i);
            labels.push(d.toISOString().split('T')[0]);
        }
        sql = `SELECT meeting_date as label, COUNT(id) as count FROM meetings 
               WHERE meeting_date >= ? AND meeting_date <= ? GROUP BY meeting_date`;
        params = [labels[0], labels[6]];

    } else if (filter === 'month') {
        // Tự động đẻ ra 12 tháng lùi về quá khứ
        for (let i = 11; i >= 0; i--) {
            const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
            labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        sql = `SELECT SUBSTR(meeting_date, 1, 7) as label, COUNT(id) as count FROM meetings 
               WHERE SUBSTR(meeting_date, 1, 7) >= ? AND SUBSTR(meeting_date, 1, 7) <= ? GROUP BY SUBSTR(meeting_date, 1, 7)`;
        params = [labels[0], labels[11]];

    } else if (filter === 'year') {
        // Tự động đẻ ra 5 năm lùi về quá khứ
        const currentYear = refDate.getFullYear();
        for (let i = 4; i >= 0; i--) { labels.push(`${currentYear - i}`); }
        sql = `SELECT SUBSTR(meeting_date, 1, 4) as label, COUNT(id) as count FROM meetings 
               WHERE SUBSTR(meeting_date, 1, 4) >= ? AND SUBSTR(meeting_date, 1, 4) <= ? GROUP BY SUBSTR(meeting_date, 1, 4)`;
        params = [labels[0], labels[4]];
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Thuật toán "Lấp chỗ trống": Đưa dữ liệu SQL vào mảng, ngày nào trống ép thành 0
        const dataMap = {};
        rows.forEach(r => dataMap[r.label] = r.count);
        const finalData = labels.map(label => dataMap[label] || 0);

        res.json({ labels: labels, data: finalData });
    });
});
// =================================================================
// API Lấy chi tiết cuộc họp và tính số phòng trống theo ngày
// =================================================================
app.get('/api/dashboard/details', (req, res) => {
    const targetDate = req.query.date; // Ngày cần tra cứu (YYYY-MM-DD)
    const TOTAL_ROOMS = 10; // Giả định công ty có 10 phòng họp

    const sql = `SELECT room_name, booked_by FROM meetings WHERE meeting_date = ?`;
    db.all(sql, [targetDate], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Trả dữ liệu về cho giao diện
        res.json({
            total_rooms: TOTAL_ROOMS,
            booked_count: rows.length,
            available_count: TOTAL_ROOMS - rows.length,
            bookings: rows // Danh sách chi tiết ai đặt phòng nào
        });
    });
});

// =================================================================
// KHỞI CHẠY SERVER (LUÔN ĐẶT Ở CUỐI FILE)
// =================================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`-> Server đang hoạt động ổn định tại: http://localhost:${PORT}`);
});
