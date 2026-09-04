pub struct LineItem {
    sku: String,
    price: f64,
    qty: u32,
}

pub fn total(items: &[LineItem], coupon: Option<&Coupon>) -> f64 {
    let subtotal: f64 = items.iter().map(|it| it.price * it.qty as f64).sum();
    match coupon {
        Some(c) => subtotal * (1.0 - c.percent as f64 / 100.0),
        None => subtotal,
    }
}
