//! Lệnh ESC/POS gửi thẳng tới máy in hóa đơn.

/// Xung mở ngăn kéo tiền: `ESC p m t1 t2` — chân m (0 = chân 2, 1 = chân 5), bật 50 ms, nghỉ 500 ms.
/// Gần như mọi máy in nhiệt (Xprinter, Epson, Gprinter, Rongta…) hỗ trợ lệnh này.
pub fn drawer_pulse(pin: u8) -> Vec<u8> {
    vec![0x1B, 0x70, if pin == 1 { 1 } else { 0 }, 25, 250]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pulse_bytes() {
        assert_eq!(drawer_pulse(0), vec![0x1B, 0x70, 0, 25, 250]);
        assert_eq!(drawer_pulse(1), vec![0x1B, 0x70, 1, 25, 250]);
        assert_eq!(drawer_pulse(7), vec![0x1B, 0x70, 0, 25, 250]);
    }
}
