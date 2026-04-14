## MODIFIED Requirements

### Requirement: Explicit membership tools for the agent
The system SHALL provide explicit API/tool support for membership operations used in WhatsApp conversations.

#### Scenario: Membership summary exposes referral and messaging state
- WHEN Jake retrieves a guest membership summary
- THEN the summary SHALL expose referral code, referred-by attribution, referral totals, and messaging-preference state when available
- SO THAT the agent and operators do not need to reconstruct club state from multiple unrelated endpoints

#### Scenario: Reward metadata stays trustworthy across agent-facing payloads
- WHEN a live reward stores template guidance metadata
- THEN membership-summary and related loyalty API payloads SHALL preserve that metadata end-to-end
- SO THAT the agent can understand why the reward exists and how it should be offered
