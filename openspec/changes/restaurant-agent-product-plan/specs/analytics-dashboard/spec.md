## ADDED Requirements

### Requirement: Reservation analytics
The system SHALL display reservation metrics: total bookings, covers, occupancy rate by time slot, cancellation rate, no-show rate, average party size, and peak hours — filterable by day/week/month.

#### Scenario: Owner views weekly reservation stats
- **WHEN** the owner requests analytics for this week
- **THEN** the system SHALL display total reservations, covers, occupancy heatmap by hour, cancellation rate, and no-show rate

### Requirement: Guest retention metrics
The system SHALL calculate and display: new vs returning guest ratio, visit frequency distribution, retention rate (% of guests who return within 30/60/90 days), and churn rate.

#### Scenario: Owner checks retention rate
- **WHEN** the owner views retention analytics
- **THEN** the system SHALL show the 30/60/90-day retention rates with trend comparison to the previous period

### Requirement: Customer lifetime value (CLV)
The system SHALL estimate CLV per guest based on visit frequency, average spend (if available), and tenure. Aggregate CLV SHALL be shown per segment.

#### Scenario: CLV by tier
- **WHEN** the owner views CLV analytics
- **THEN** the system SHALL show average CLV for Bronze, Silver, and Gold tier guests

### Requirement: Campaign ROI
The system SHALL track campaign performance: messages sent, delivered, read, replied, reservations attributed, and estimated revenue driven. ROI SHALL be calculated as revenue attributed / campaign cost.

#### Scenario: Campaign performance report
- **WHEN** a campaign finishes
- **THEN** the system SHALL generate a report showing delivery rate, response rate, reservations generated, and ROI

### Requirement: Loyalty program analytics
The system SHALL display: active loyalty members, points issued vs redeemed, redemption rate, tier distribution, and program cost (value of rewards redeemed).

#### Scenario: Monthly loyalty report
- **WHEN** the owner requests loyalty analytics for March
- **THEN** the system SHALL show new enrollments, points issued, rewards redeemed, and program cost estimate

### Requirement: WhatsApp-based reporting
The system SHALL deliver key metrics as a daily WhatsApp summary to the owner — no need to log into a dashboard for basic stats.

#### Scenario: Daily morning summary
- **WHEN** it is 09:00 local time
- **THEN** the system SHALL send the owner a WhatsApp summary: yesterday's covers, today's bookings, notable guests arriving today, and any alerts
