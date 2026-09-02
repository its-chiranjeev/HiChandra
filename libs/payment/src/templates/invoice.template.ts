export interface PaymentInvoiceTemplateData {
  invoiceTitle: string;
  invoiceId: string;
  dateLabel: string;

  customerName: string;
  customerEmail: string;
  customerPhone: string;

  serviceName: string;
  bookingId: number;
  bookingStatus: string;

  paymentId: string;
  orderId: string;
  paymentStatus: string;
  paymentMethod: string;

  currency: string;
  amount: string;

  date: string;
  statusClass: string;
  errorMessage: string;

  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyGstin: string;

  billingAddress: string;
  technicianName: string;

  serviceBasePrice: string;
  gstPercent: string;
  gstAmount: string;
  platformFee: string;
  finalAmount: string;
}

export const paymentInvoiceTemplate = (
  data: PaymentInvoiceTemplateData,
): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 10px 15px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #ffffff;
      color: #334155;
      font-size: 12px;
      line-height: 1.3;
    }
    .container {
      width: 100%;
      background: #ffffff;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .header-left h2 {
      margin: 0 0 4px 0;
      font-size: 20px;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-left p, .header-right p {
      margin: 2px 0;
      color: #475569;
    }
    .header-right {
      text-align: right;
    }
    
    /* 2-column layout for Company and Customer */
    .info-section {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      margin-bottom: 15px;
    }
    .info-block {
      width: 48%;
      background: #f8fafc;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .section-title {
      margin-top: 0;
      margin-bottom: 6px;
      font-size: 13px;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    
    .detail-grid {
      display: table;
      width: 100%;
    }
    .detail-row {
      display: table-row;
    }
    .detail-label, .detail-value {
      display: table-cell;
      padding: 2px 0;
      vertical-align: top;
      font-size: 11px;
    }
    .detail-label {
      width: 90px;
      font-weight: 600;
      color: #64748b;
    }
    .detail-value {
      color: #334155;
    }
    
    /* Booking Details */
    .booking-section {
      margin-bottom: 15px;
    }
    .booking-grid {
      display: flex;
      flex-wrap: wrap;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .booking-item {
      width: 25%;
      padding: 3px 0;
    }
    .booking-item .label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
      font-weight: bold;
    }
    .booking-item .value {
      font-size: 12px;
      font-weight: 500;
    }

    /* Tables */
    .tables-section {
      display: flex;
      flex-direction: column;
      gap: 25px;
    }
    .table-wrapper {
      width: 100%;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      font-size: 11px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .amount-cell {
      text-align: right;
    }
    .total-row td {
      font-weight: bold;
      font-size: 13px;
      background-color: #f8fafc;
      border-top: 2px solid #cbd5e1;
    }
    
    .status-badge {
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
    }
    .success { color: #15803d; background: #dcfce7; }
    .failed { color: #b91c1c; background: #fee2e2; }
    .pending { color: #b45309; background: #fef3c7; }

    .footer {
      margin-top: 15px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 10px;
    }
  </style>
</head>

<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h2>${data.invoiceTitle}</h2>
        <p><strong>Invoice ID:</strong> ${data.invoiceId || '-'}</p>
      </div>
      <div class="header-right">
        <p><strong>${data.dateLabel}:</strong> ${data.date || '-'}</p>
      </div>
    </div>

    <!-- 2 Column Info -->
    <div class="info-section">
      <!-- Company Details -->
      <div class="info-block">
        <h3 class="section-title">From (HiChandra)</h3>
        <div class="detail-grid">
          <div class="detail-row">
            <div class="detail-label">Name:</div>
            <div class="detail-value">${data.companyName || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Email:</div>
            <div class="detail-value">${data.companyEmail || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Phone:</div>
            <div class="detail-value">${data.companyPhone || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Address:</div>
            <div class="detail-value">${data.companyAddress || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">GSTIN:</div>
            <div class="detail-value">${data.companyGstin || '-'}</div>
          </div>
        </div>
      </div>

      <!-- Customer Details -->
      <div class="info-block">
        <h3 class="section-title">Bill To (Customer)</h3>
        <div class="detail-grid">
          <div class="detail-row">
            <div class="detail-label">Name:</div>
            <div class="detail-value">${data.customerName || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Email:</div>
            <div class="detail-value">${data.customerEmail || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Phone:</div>
            <div class="detail-value">${data.customerPhone || '-'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Address:</div>
            <div class="detail-value">${data.billingAddress || '-'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Highlights -->
    <div class="booking-section">
      <div class="booking-grid">
        <div class="booking-item">
          <div class="label">Booking ID</div>
          <div class="value">#${data.bookingId}</div>
        </div>
        <div class="booking-item">
          <div class="label">Service</div>
          <div class="value">${data.serviceName || '-'}</div>
        </div>
        <div class="booking-item">
          <div class="label">Technician</div>
          <div class="value">${data.technicianName || '-'}</div>
        </div>
        <div class="booking-item">
          <div class="label">Status</div>
          <div class="value" style="text-transform: capitalize;">${data.bookingStatus || '-'}</div>
        </div>
      </div>
    </div>

    <!-- Tables Layout -->
    <div class="tables-section">
      
      <!-- Payment Details Table -->
      <div class="table-wrapper">
        <h3 class="section-title">Payment Info</h3>
        <table>
          <tbody>
            <tr>
              <td>Payment Status</td>
              <td><span class="status-badge ${data.statusClass}">${data.paymentStatus || 'Pending'}</span></td>
            </tr>
            <tr>
              <td>Payment Method</td>
              <td>${data.paymentMethod || '-'}</td>
            </tr>
            <tr>
              <td>Transaction ID</td>
              <td>${data.paymentId || '-'}</td>
            </tr>
            <tr>
              <td>Order ID</td>
              <td>${data.orderId || '-'}</td>
            </tr>
            ${data.errorMessage && data.errorMessage !== '-' ? `
            <tr>
              <td>Error</td>
              <td class="failed">${data.errorMessage}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- Pricing Breakdown Table -->
      <div class="table-wrapper">
        <h3 class="section-title">Pricing Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="amount-cell">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Service Base Price</td>
              <td class="amount-cell">${data.currency} ${data.serviceBasePrice}</td>
            </tr>
            <tr>
              <td>GST (${data.gstPercent}%)</td>
              <td class="amount-cell">${data.currency} ${data.gstAmount}</td>
            </tr>
            ${Number(data.platformFee) > 0 ? `
            <tr>
              <td>Platform Fee</td>
              <td class="amount-cell">${data.currency} ${data.platformFee}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td>Total Amount</td>
              <td class="amount-cell" style="color: #1e40af;">${data.currency} ${data.finalAmount}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      ${data.invoiceTitle === 'HiChandra Proforma Invoice'
      ? `<p><strong>Note:</strong> This is a Proforma Invoice generated for a booking with pending payment. It is not a final tax invoice. A final invoice will be available after successful payment.</p>`
      : `<p>Payment received successfully. Thank you for using HiChandra!</p><p>This invoice includes GST at the rate mentioned in the pricing breakdown.</p>`
    }
    </div>
  </div>
</body>
</html>
`;
};
