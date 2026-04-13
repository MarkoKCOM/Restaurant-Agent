## ADDED Requirements

### Requirement: Membership summary exposes reward guidance
The normalized membership summary SHALL expose enough reward metadata for the WhatsApp agent to choose a fitting live reward.

#### Scenario: Agent handles birthday moment
- WHEN Jake retrieves a guest membership summary
- AND the restaurant has an active reward configured for birthday moments
- THEN the summary SHALL expose that reward’s template or recommended-moment metadata
- AND expose example pitch copy if it exists

#### Scenario: Agent handles comeback or referral moment
- WHEN Jake retrieves a guest membership summary
- AND active rewards are configured for comeback or referral moments
- THEN the summary SHALL expose which live rewards fit those moments
- WITHOUT requiring the agent to infer strategy from raw reward names alone

### Requirement: Guidance metadata is optional but preserved end-to-end
Reward guidance metadata SHALL survive reward create, update, list, and membership summary flows.

#### Scenario: Reward metadata round-trip
- WHEN a reward with template metadata is created or updated
- THEN the reward list API SHALL return that metadata
- AND the membership summary SHALL return that metadata for active rewards
- AND legacy rewards without metadata SHALL continue to work without errors
