import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  renderBaseEmailTemplate,
  BaseEmailOptions,
} from './templates/base-email.template';
import { getLogoAttachment } from './assets/logo.asset';

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

  // Nodemailer SMTP
  private async sendMail(options: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: nodemailer.SendMailOptions['attachments'];
  }) {
    try {
      const attachments = [...(options.attachments || [])];
      if (options.html.includes('cid:hichandra-logo')) {
        const logo = getLogoAttachment();
        if (logo) {
          attachments.unshift(logo);
        }
      }

      await this.transporter.sendMail({
        from: process.env[`EMAIL_FROM`],
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments,
      });
    } catch (error) {
      this.logger.error('SMTP email failed', error);
      throw error;
    }
  }

  /**
   * Generic method to send any email using the base HiChandra email template.
   */
  async sendTemplateEmail(
    to: string | string[],
    subject: string,
    options: BaseEmailOptions,
  ) {
    const html = renderBaseEmailTemplate({
      ...options,
      emailTitle: options.emailTitle || subject,
    });

    return this.sendMail({
      to,
      subject,
      html,
    });
  }

  async sendOtpEmail(email: string, otp: string, firstName?: string) {
    const html = renderBaseEmailTemplate({
      emailTitle: 'Your OTP Code - HiChandra',
      badgeText: 'Verification',
      mainHeading: 'One-Time Verification Code',
      userName: firstName || 'User',
      messageText:
        'Please use the one-time verification code below to verify your account or authorize your request. This code is confidential and should not be shared with anyone.',
      otp: {
        code: otp,
        label: 'Verification Code',
        validityNote: '⏱ Valid for 10 minutes',
      },
      footerNote:
        '🔒 If you did not request this OTP code, please disregard this email or contact HiChandra support immediately.',
    });

    return this.sendMail({
      to: email,
      subject: 'Your OTP Code - HiChandra',
      html,
    });
  }

  async sendCustomerWelcomeEmail(
    email: string,
    firstName: string,
    password: string,
  ) {
    const html = renderBaseEmailTemplate({
      emailTitle: 'Welcome to HiChandra - Account Credentials',
      badgeText: 'Account Created',
      mainHeading: 'Welcome to HiChandra!',
      userName: firstName,
      messageText:
        'Welcome to our platform! Your customer account has been created successfully. You can use the temporary credentials below to log in and schedule trusted home services:',
      details: [
        { label: 'Email Address', value: email },
        { label: 'Temporary Password', value: password },
        { label: 'Account Type', value: 'Customer' },
      ],
      cta: {
        text: 'Log In to HiChandra',
        url: 'https://hichandra.com',
      },
      footerNote:
        '⚠️ For your security, please make sure to change your password immediately after logging in.',
    });

    return this.sendMail({
      to: email,
      subject: 'Welcome to HiChandra - Account Credentials',
      html,
    });
  }

  async sendTechnicianWelcomeEmail(
    email: string,
    firstName: string,
    password: string,
  ) {
    const html = renderBaseEmailTemplate({
      emailTitle: 'Welcome to HiChandra - Technician Account Created',
      badgeText: 'Technician Partner',
      mainHeading: 'Welcome to the HiChandra Team!',
      userName: firstName,
      messageText:
        'Your technician profile has been created successfully by the Admin. Please log in to complete your profile setup and start receiving booking assignments:',
      details: [
        { label: 'Login Email', value: email },
        { label: 'Temporary Password', value: password },
        { label: 'Account Role', value: 'Technician Partner' },
      ],
      cta: {
        text: 'Access Technician Portal',
        url: 'https://hichandra.com',
      },
      footerNote:
        '⚠️ For your security, please change your password immediately upon your first login.',
    });

    return this.sendMail({
      to: email,
      subject: 'Welcome to HiChandra - Technician Account Created',
      html,
    });
  }

  async sendCustomerBookingConfirmation(
    email: string,
    booking: any,
    isUpdate = false,
  ) {
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
    const rawDate = booking.scheduledAt || booking.fromTime || booking.createdAt;
    const scheduledAt = rawDate ? new Date(rawDate) : null;
    const isValidDate = scheduledAt instanceof Date && !isNaN(scheduledAt.getTime());
    const dateStr = isValidDate
      ? scheduledAt.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'As per schedule';
    const timeStr = isValidDate
      ? scheduledAt.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Flexible';

    const subject = isUpdate
      ? 'Technician Assigned to Your Booking - HiChandra'
      : 'Booking Scheduled Successfully - HiChandra';

    const messageText = isUpdate
      ? `Your booking <strong>#${booking.id}</strong> has been updated and a verified technician has been successfully assigned to your service.`
      : `Your booking <strong>#${booking.id}</strong> has been successfully scheduled with HiChandra. Our verified professional will arrive at the scheduled time.`;

    const details = [
      { label: 'Booking ID', value: `#${booking.id}` },
      { label: 'Status', value: booking.status || 'CONFIRMED' },
      { label: 'Service', value: booking.service?.name || 'N/A' },
      { label: 'Scheduled Date', value: dateStr },
      { label: 'Scheduled Time', value: timeStr },
      ...(techName ? [{ label: 'Assigned Technician', value: techName }] : []),
      { label: 'Service Address', value: addressStr },
      { label: 'Total Amount', value: `₹${booking.totalAmount || 0}` },
    ];

    const html = renderBaseEmailTemplate({
      emailTitle: subject,
      badgeText: isUpdate ? 'Technician Assigned' : 'Booking Confirmed',
      mainHeading: isUpdate
        ? 'Technician Assigned to Your Booking'
        : 'Booking Scheduled Successfully',
      userName: customerName,
      messageText,
      details,
      cta: {
        text: 'View Booking Details',
        url: 'https://hichandra.com',
      },
      footerNote:
        'Need to reschedule or have questions? You can manage your booking via your HiChandra account or contact our 24/7 support team.',
    });

    return this.sendMail({
      to: email,
      subject,
      html,
    });
  }

  async sendTechnicianAssignment(
    email: string,
    booking: any,
    isReassignment = false,
  ) {
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
    const dateStr = scheduledAt.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = scheduledAt.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = isReassignment
      ? 'Booking Reassigned to You - HiChandra'
      : 'New Booking Assigned to You - HiChandra';

    const payoutAmount = booking.priceBreakdown?.technicianEarning || 0;
    const totalAmount = booking.totalAmount || 0;

    const details = [
      { label: 'Booking ID', value: `#${booking.id}` },
      { label: 'Status', value: booking.status || 'ASSIGNED' },
      { label: 'Service', value: booking.service?.name || 'N/A' },
      { label: 'Scheduled Date', value: dateStr },
      { label: 'Scheduled Time', value: timeStr },
      { label: 'Customer Name', value: customerName },
      { label: 'Customer Phone', value: customerPhone },
      { label: 'Service Location', value: addressStr },
      { label: 'Your Payout', value: `₹${payoutAmount}` },
      { label: 'Total Booking Amount', value: `₹${totalAmount}` },
    ];

    const html = renderBaseEmailTemplate({
      emailTitle: subject,
      badgeText: isReassignment ? 'Reassigned' : 'New Assignment',
      mainHeading: isReassignment
        ? 'Booking Reassigned to You'
        : 'New Booking Assigned to You',
      userName: techName,
      messageText:
        'A new service booking has been assigned to you. Please review the customer details and schedule below, and contact the customer prior to arrival if necessary:',
      details,
      cta: {
        text: 'Open Technician App',
        url: 'https://hichandra.com',
      },
      footerNote:
        'Please check your technician app for more details and follow all standard safety and service protocols.',
    });

    return this.sendMail({
      to: email,
      subject,
      html,
    });
  }
}

