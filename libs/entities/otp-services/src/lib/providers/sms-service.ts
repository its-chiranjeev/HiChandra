import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private client: Twilio;

  constructor() {
    this.client = new Twilio(
      process.env['TWILIO_ACCOUNT_SID'],
      process.env['TWILIO_AUTH_TOKEN'],
    );
  }

  public async sendSms(to: string, body: string) {
    return await this.client.messages.create({
      from: process.env['TWILIO_PHONE_NUMBER'],
      to,
      body,
    });
  }

  public async sendOtpSms(to: string, otp: string) {
    return await this.sendSms(
      to.startsWith('+') ? to : `+91${to}`,
      `Your HiChandra OTP is ${otp}. This OTP expires in 10 minutes.`,
    );
  }
}