/**
 * Booking link provider (PRD §5.1 layer 5). Kept behind a tiny interface so a
 * future Calendly API integration (event-type lookup, availability) can drop
 * in without touching the orchestrator.
 */
export interface BookingProvider {
  /** Returns the URL to send a lead so they can book the strategy call. */
  bookingUrl(): string;
}

export class CalendlyLink implements BookingProvider {
  constructor(private readonly url: string) {
    // Fail fast on obviously bad config rather than DM a broken link.
    if (!/^https:\/\/(www\.)?calendly\.com\//.test(url)) {
      throw new Error(`CALENDLY_BOOKING_URL must be a https calendly.com URL, got: ${url}`);
    }
  }
  bookingUrl(): string {
    return this.url;
  }
}
