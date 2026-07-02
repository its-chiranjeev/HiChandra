export interface PaymentInvoiceTemplateData {
  invoiceId: string;
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
}

export const paymentInvoiceTemplate = (
  data: PaymentInvoiceTemplateData,
): string => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial; padding: 30px; background: #f3f4f6; }
      .container { background: white; padding: 30px; border-radius: 10px; }
      .header { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; }
      .success { color: green; font-weight: bold; }
      .failed { color: red; font-weight: bold; }
      .pending { color: orange; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      td, th { border: 1px solid #ddd; padding: 10px; }
      .total { text-align: right; font-size: 20px; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>HiChandra Invoice</h2>
        <p><b>Invoice ID:</b> ${data.invoiceId}</p>
      </div>

      <h3>Customer Details</h3>
      <p><b>Name:</b> ${data.customerName}</p>
      <p><b>Email:</b> ${data.customerEmail}</p>
      <p><b>Phone:</b> ${data.customerPhone}</p>

      <h3>Booking Details</h3>
      <p><b>Booking ID:</b> ${data.bookingId}</p>
      <p><b>Service:</b> ${data.serviceName}</p>
      <p><b>Booking Status:</b> ${data.bookingStatus}</p>

      <h3>Razorpay Payment Details</h3>
      <table>
        <tr><td>Payment ID</td><td>${data.paymentId}</td></tr>
        <tr><td>Order ID</td><td>${data.orderId}</td></tr>
        <tr><td>Method</td><td>${data.paymentMethod}</td></tr>
        <tr><td>Status</td><td class="${data.statusClass}">${data.paymentStatus}</td></tr>
        <tr><td>Error</td><td>${data.errorMessage}</td></tr>
        <tr><td>Date</td><td>${data.date}</td></tr>
      </table>

      <p class="total">Total: ${data.currency} ${data.amount}</p>

      <p style="text-align:center;margin-top:40px;">
        Thank you for using HiChandra.
      </p>
    </div>
  </body>
  </html>
  `;
};