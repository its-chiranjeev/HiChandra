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
  <html>
  <head>
  <meta charset="UTF-8">

  <style>

  body{
      font-family:Arial,sans-serif;
      background:#f3f4f6;
      padding:30px;
  }

  .container{
      background:#fff;
      padding:35px;
      border-radius:10px;
  }

  .header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      border-bottom:2px solid #ddd;
      padding-bottom:15px;
  }

  .success{
      color:#16a34a;
      font-weight:bold;
  }

  .failed{
      color:#dc2626;
      font-weight:bold;
  }

  .pending{
      color:#d97706;
      font-weight:bold;
  }

  table{
      width:100%;
      border-collapse:collapse;
      margin-top:15px;
  }

  td{
      border:1px solid #ddd;
      padding:10px;
  }

  .section-title{
      margin-top:30px;
  }

  .total{
      text-align:right;
      font-size:22px;
      font-weight:bold;
      margin-top:25px;
  }

  .footer{
      margin-top:45px;
      text-align:center;
      color:#555;
  }

  </style>

  </head>

  <body>

  <div class="container">

 <div class="header">

  <div>
    <h2>${data.invoiceTitle}</h2>
    <p><strong>Invoice ID:</strong> ${data.invoiceId}</p>
  </div>

  <div>
    <p><strong>${data.dateLabel}:</strong> ${data.date}</p>
  </div>

</div>

<h3 class="section-title">Company Details</h3>
<p><strong>Name:</strong> ${data.companyName}</p>
<p><strong>Email:</strong> ${data.companyEmail}</p>
<p><strong>Phone:</strong> ${data.companyPhone}</p>
<p><strong>Address:</strong> ${data.companyAddress}</p>

<h3 class="section-title">Customer Details</h3>
<p><strong>Name:</strong> ${data.customerName}</p>
<p><strong>Email:</strong> ${data.customerEmail}</p>
<p><strong>Phone:</strong> ${data.customerPhone}</p>
<p><strong>Billing Address:</strong> ${data.billingAddress}</p>

<h3 class="section-title">Booking Details</h3>
<p><strong>Booking ID:</strong> ${data.bookingId}</p>
<p><strong>Service:</strong> ${data.serviceName}</p>
<p><strong>Technician:</strong> ${data.technicianName}</p>
<p><strong>Booking Status:</strong> ${data.bookingStatus}</p>

<h3 class="section-title">Pricing Breakdown</h3>
<table>
  <tr>
    <td>Service Base Price</td>
    <td>${data.currency} ${data.serviceBasePrice}</td>
  </tr>

  <tr>
    <td>GST (${data.gstPercent}%)</td>
    <td>${data.currency} ${data.gstAmount}</td>
  </tr>

  <tr>
    <td>Platform Fee</td>
    <td>${data.currency} ${data.platformFee}</td>
  </tr>

  <tr>
    <td><strong>Final Amount</strong></td>
    <td><strong>${data.currency} ${data.finalAmount}</strong></td>
  </tr>
</table>

<h3 class="section-title">Payment Details</h3>

<table>
  <tr>
    <td>Payment Status</td>
    <td class="${data.statusClass}">
      ${data.paymentStatus}
    </td>
  </tr>

  <tr>
    <td>Payment Method</td>
    <td>${data.paymentMethod}</td>
  </tr>

  <tr>
    <td>Transaction ID</td>
    <td>${data.paymentId}</td>
  </tr>

  <tr>
    <td>Order ID</td>
    <td>${data.orderId}</td>
  </tr>

  ${
    data.errorMessage && data.errorMessage !== '-'
      ? `
  <tr>
    <td>Error</td>
    <td>${data.errorMessage}</td>
  </tr>
  `
      : ''
  }
</table>

<p class="total">
  Total: ${data.currency} ${data.finalAmount}
</p>

<div class="footer">
  ${
    data.invoiceTitle === 'HiChandra Proforma Invoice'
      ? `
  <p>
    <b>Note:</b> This is a Proforma Invoice generated for a booking with pending payment.
    It is not a final tax invoice. A final invoice will be available once payment is completed successfully.
  </p>
  `
      : `
  <p>
    Payment received successfully. Thank you for using HiChandra.
  </p>
  `
  }
</div>

</div>

</body>
</html>
`;
  };