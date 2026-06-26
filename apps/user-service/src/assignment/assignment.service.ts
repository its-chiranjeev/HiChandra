import { Injectable, Logger } from '@nestjs/common';
import {
  User,
  CustomerAddress,
  TechnicianLocation,
  Booking,
  Service,
} from '@hichandra/entities';
import { BookingGateway } from '@hichandra/gateway';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(private readonly bookingGateway: BookingGateway) {}

  async assignTechnician(
    booking: Booking,
    technicians: User[],
    customerAddress: CustomerAddress,
    service: Service,
  ): Promise<User[]> {
    this.logger.log(
      `Filtering matching technicians for booking ID ${booking.id}...`,
    );
    const matchedTechnicians = technicians.filter((user) => {
      const locationsVal = user.technicianProfile?.locations;
      if (!locationsVal) {
        return false;
      }

      const location = Array.isArray(locationsVal)
        ? locationsVal[0]
        : locationsVal;
      if (location) {
        return this.filterTechnicianBasedOnLocationLatLong(
          location,
          customerAddress,
        );
      }
      return false;
    });

    this.logger.log(
      `Found ${matchedTechnicians.length} technicians within radius.`,
    );
    console.log(matchedTechnicians);
    // Send notifications to filtered technicians
    await this.sendNotificationsToTechnicians(
      booking,
      matchedTechnicians,
      service,
      customerAddress, //added
    );
    return matchedTechnicians;
  }

  private filterTechnicianBasedOnLocationLatLong(
    technicianLocation: TechnicianLocation,
    customerAddress: CustomerAddress,
  ): boolean {
    const haversineDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = haversineDistance(
      Number(technicianLocation.latitude),
      Number(technicianLocation.longitude),
      Number(customerAddress.latitude),
      Number(customerAddress.longitude),
    );

    return distance <= Number(technicianLocation.serviceRadiusKm);
  }

//   private async sendNotificationsToTechnicians(
//     booking: Booking,
//     technicians: User[],
//     service: Service,
//     customerAddress: CustomerAddress, //added
//   ): Promise<void> {
//     for (const tech of technicians) {
//       this.logger.log(
//         `Sending booking notification to technician ID ${tech.id} (${tech.email}) for Booking ID ${booking.id} (Service: ${service.name})`,
//       );

//       // const isOnline = this.bookingGateway.notifyUser(tech.id, {
//       //   bookingId: booking.id,
//       //   //added
//       //    bookingInfo: {
//       //     id: booking.id,
//       //     status: booking.status,
//       //     scheduledAt: booking.scheduledAt,
//       //     isEmergency: booking.isEmergency,
//       //     totalAmount: booking.totalAmount,
//       //   },

//       //   service: service.name,
//       //   scheduledAt: booking.scheduledAt,
//       //   isEmergency: booking.isEmergency,
//       // });

    private async sendNotificationsToTechnicians(
      booking: Booking,
      technicians: User[],
      service: Service,
      customerAddress: CustomerAddress,
    ): Promise<void> {
      for (const tech of technicians) {
        this.logger.log(
          `Sending booking notification to technician ID ${tech.id} (${tech.email}) for Booking ID ${booking.id} (Service: ${service.name})`,
        );

        const {
          password,
          hashedRefreshToken,
          ...safeCustomer
        } = booking.customer || {};

        const isOnline = this.bookingGateway.notifyUser(tech.id, {
          bookingId: booking.id,

          bookingInfo: {
            ...booking,
            customer: undefined,
            service: undefined,
            address: undefined,
            technician: undefined,
          },

          serviceInfo: {
            ...service,
          },

          customerInfo: {
            ...safeCustomer,
            name: `${safeCustomer.firstName || ''} ${safeCustomer.lastName || ''}`.trim(),
          },

          addressInfo: {
            ...customerAddress,
          },
        });
  
      this.logger.log(
        `Technician notification status for ID ${tech.id}: ${isOnline ? 'Online/Delivered' : 'Offline'}`,
      );
    }
  }
}
