const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());

// Chỉ định thư mục chứa file giao diện HTML
app.use(express.static(path.join(__dirname, 'public')));



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