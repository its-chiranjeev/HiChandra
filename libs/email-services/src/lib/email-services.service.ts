import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  // TODO: This is for sendgrid
  // constructor() {
  //     sgMail.setApiKey(process.env['SENDGRID_API_KEY']!);
  // }

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
      auth: {
        user: process.env['SMTP_USERNAME'],
        pass: process.env['SMTP_PASSWORD'],
      },
      pool: true,
      maxConnections: 5,
    });
  }

  // TODO: This is for sendgrid
  // private async sendMail(options: {
  //     to: string | string[];
  //     subject: string;
  //     html: string;
  // }) {
  //     try {
  //         await sgMail.send({
  //             to: options.to,
  //             from: process.env['EMAIL_FROM']!,
  //             subject: options.subject,
  //             html: options.html,
  //         });
  //     } catch (error) {
  //         this.logger.error('SendGrid email failed', error);
  //         throw error;
  //     }
  // }

  // TODO:THis is for Nodemailer SMTP
  private async sendMail(options: {
    to: string | string[];
    subject: string;
    html: string;
  }) {
    try {
      await this.transporter.sendMail({
        from: process.env[`EMAIL_FROM`],
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      this.logger.error('SMTP email failed', error);
      throw error;
    }
  }

  async sendOtpEmail(email: string, otp: string, firstName?: string) {
    const html = `
            <div>
            <h2>Hello ${firstName ?? 'User'}</h2>
            <p>Your OTP code is:</p>
            <h1 style="letter-spacing:4px">${otp}</h1>
            <p>This code expires in 10 minutes.</p>
            </div>
        `;

    return this.sendMail({
      to: email,
      subject: 'Your OTP Code',
      html,
    });
  }

  async sendCustomerWelcomeEmail(email: string, firstName: string, password: string) {
    const html = `
            <div>
            <h2>Hello ${firstName},</h2>
            <p>Welcome to our platform! Your account has been created successfully.</p>
            <p>Your login credentials are:</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <br />
            <p style="color: red; font-weight: bold;">For your security, please make sure to change your password immediately after logging in.</p>
            </div>
        `;

    return this.sendMail({
      to: email,
      subject: 'Welcome to Our Platform - Account Credentials',
      html,
    });
  }

  async sendTechnicianWelcomeEmail(email: string, firstName: string, password: string) {
    const html = `
            <div>
            <h2>Hello ${firstName},</h2>
            <p>Welcome to HiChandra! Your technician profile has been created successfully by the Admin.</p>
            <p>Your login credentials are:</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <br />
            <p style="color: red; font-weight: bold;">For your security, please make sure to change your password immediately after logging in.</p>
            <p>Please log in to complete your profile setup.</p>
            </div>
        `;

    return this.sendMail({
      to: email,
      subject: 'Welcome to HiChandra - Technician Account Created',
      html,
    });
  }
  async sendCustomerBookingConfirmation(email: string, booking: any, isUpdate = false) {
    const customerName = booking.customer?.firstName 
      ? `${booking.customer.firstName} ${booking.customer.lastName || ''}`.trim() 
      : 'Customer';

    const techName = booking.technician?.firstName 
      ? `${booking.technician.firstName} ${booking.technician.lastName || ''}`.trim() 
      : null;

    const addressStr = booking.address?.fullAddress
      ? `${booking.address.fullAddress}, ${booking.address.city || ''}`
      : 'Address not available';

    // Format Date/Time (Assuming IST)
    const scheduledAt = new Date(booking.scheduledAt);
    const dateStr = scheduledAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = scheduledAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

    const subject = isUpdate ? 'Technician Assigned to Your Booking - HiChandra' : 'Booking Scheduled Successfully - HiChandra';
    
    let messageHtml = isUpdate 
      ? `<p>Your booking has been updated and a technician has been successfully assigned.</p>`
      : `<p>Your booking has been successfully scheduled with HiChandra. Your service is scheduled for the selected date and time.</p>`;

    if (techName) {
      messageHtml += `<p><strong>Assigned Technician:</strong> ${techName}</p>`;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4CAF50; color: white; padding: 15px; text-align: center;">
          <h2>HiChandra</h2>
        </div>
        <div style="padding: 20px;">
          <h3>Hello ${customerName},</h3>
          ${messageHtml}
          
          <h4>Booking Details:</h4>
          <ul>
            <li><strong>Booking ID:</strong> #${booking.id}</li>
            <li><strong>Status:</strong> ${booking.status}</li>
            <li><strong>Service:</strong> ${booking.service?.name || 'N/A'}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Address:</strong> ${addressStr}</li>
          </ul>

          <h4>Payment Details:</h4>
          <ul>
            <li><strong>Total Amount:</strong> ₹${booking.totalAmount || 0}</li>
          </ul>
          
          <br />
          <p>Thank you for choosing HiChandra!</p>
        </div>
        <div style="background-color: #f1f1f1; color: #777; padding: 10px; text-align: center; font-size: 12px;">
          &copy; ${new Date().getFullYear()} HiChandra. All rights reserved.
        </div>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
    });
  }

  async sendTechnicianAssignment(email: string, booking: any, isReassignment = false) {
    const techName = booking.technician?.firstName 
      ? `${booking.technician.firstName} ${booking.technician.lastName || ''}`.trim() 
      : 'Technician';

    const customerName = booking.customer?.firstName 
      ? `${booking.customer.firstName} ${booking.customer.lastName || ''}`.trim() 
      : 'Customer';
    const customerPhone = booking.customer?.phone || 'N/A';

    const addressStr = booking.address?.fullAddress
      ? `${booking.address.fullAddress}, ${booking.address.city || ''}`
      : 'Address not available';

    // Format Date/Time (Assuming IST)
    const scheduledAt = new Date(booking.scheduledAt);
    const dateStr = scheduledAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = scheduledAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

    const subject = isReassignment ? 'Booking Reassigned to You - HiChandra' : 'New Booking Assigned to You - HiChandra';
    
    const payoutAmount = booking.priceBreakdown?.technicianEarning || 0;
    const totalAmount = booking.totalAmount || 0;

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2196F3; color: white; padding: 15px; text-align: center;">
          <h2>HiChandra</h2>
        </div>
        <div style="padding: 20px;">
          <h3>Hello ${techName},</h3>
          <p>A new booking has been assigned to you.</p>
          
          <div style="background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Your Payout:</strong> ₹${payoutAmount}</p>
            <p style="margin: 5px 0;"><strong>Booking Amount:</strong> ₹${totalAmount}</p>
          </div>
          
          <h4>Service Details:</h4>
          <ul>
            <li><strong>Booking ID:</strong> #${booking.id}</li>
            <li><strong>Status:</strong> ${booking.status}</li>
            <li><strong>Service:</strong> ${booking.service?.name || 'N/A'}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
          </ul>

          <h4>Customer Details:</h4>
          <ul>
            <li><strong>Name:</strong> ${customerName}</li>
            <li><strong>Phone:</strong> ${customerPhone}</li>
            <li><strong>Address:</strong> ${addressStr}</li>
          </ul>
          
          <br />
          <p>Please check your technician app for more details.</p>
        </div>
        <div style="background-color: #f1f1f1; color: #777; padding: 10px; text-align: center; font-size: 12px;">
          &copy; ${new Date().getFullYear()} HiChandra. All rights reserved.
        </div>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
    });
  }
}
