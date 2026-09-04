pub struct LineItem {
    sku: String,
    price: Decimal,
    note: Option<String>,
    qty: u32,
}

pub fn total(items: &[LineItem], coupon: Option<&Coupon>, currency: &Currency) -> Result<Decimal, PricingError> {
    let subtotal = items.iter().map(|it| it.price * it.qty.into()).fold(Decimal::ZERO, |acc, x| acc + x);
    let discount = coupon.map(|c| c.percent).unwrap_or_default();
    let rate = exchange_rate(currency)?;
    Ok(subtotal * (1.0 - discount / 100.0) * rate)
}
