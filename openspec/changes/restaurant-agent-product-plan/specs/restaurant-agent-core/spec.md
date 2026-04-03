## ADDED Requirements

### Requirement: Restaurant knowledge base
The system SHALL maintain a per-restaurant knowledge base including: restaurant name, description, cuisine type, operating hours, address, menu (items + prices + allergens), policies (cancellation, dress code, corkage), parking info, and FAQ. The agent SHALL use this to answer guest questions.

#### Scenario: Guest asks about menu
- **WHEN** a guest asks "do you have vegan options?" via WhatsApp
- **THEN** the agent SHALL search the menu and list all vegan items with prices

#### Scenario: Guest asks about parking
- **WHEN** a guest asks "is there parking?"
- **THEN** the agent SHALL respond with the configured parking information

### Requirement: Agent personality
The agent SHALL adopt the restaurant's brand personality. Owners SHALL configure the tone (formal/casual/friendly), language style, and any custom greetings. The agent SHALL feel like a natural extension of the restaurant's team, not a generic bot.

#### Scenario: Casual restaurant agent
- **WHEN** the owner configures tone as "casual and warm"
- **THEN** the agent SHALL use informal language, emojis where appropriate, and first-name greetings

#### Scenario: Fine dining restaurant agent
- **WHEN** the owner configures tone as "formal and elegant"
- **THEN** the agent SHALL use polished language, proper salutations, and no emojis

### Requirement: Intent classification
The agent SHALL classify incoming messages into intents: reservation (create/modify/cancel), inquiry (menu/hours/location/parking), loyalty (balance/redeem/tier), complaint, compliment, general conversation, and unknown. Unknown intents SHALL be escalated to the owner.

#### Scenario: Ambiguous message
- **WHEN** a guest sends "Can I bring my dog?"
- **THEN** the agent SHALL classify as "inquiry", check the restaurant's pet policy, and respond accordingly (or escalate if no policy is configured)

#### Scenario: Escalation to owner
- **WHEN** a guest sends a message the agent cannot confidently handle (e.g., "I want to rent your space for a corporate event")
- **THEN** the agent SHALL acknowledge, tell the guest someone will follow up, and forward the message to the owner

### Requirement: Conversation handoff to human
The agent SHALL support seamless handoff to a human (owner/manager) when requested by the guest or triggered by escalation rules. The human SHALL see the full conversation context.

#### Scenario: Guest requests human
- **WHEN** a guest says "I want to speak to a person"
- **THEN** the agent SHALL immediately notify the owner with the full conversation and tell the guest "I'm connecting you with [owner name], they'll reply shortly"

### Requirement: Multi-language support
The agent SHALL support Hebrew, English, Arabic, and Russian. Language SHALL be auto-detected from the first message and maintained throughout the conversation. Guests SHALL be able to switch languages mid-conversation.

#### Scenario: Language switch mid-conversation
- **WHEN** a guest starts in Hebrew then switches to English
- **THEN** the agent SHALL seamlessly continue in English

### Requirement: Owner onboarding wizard
The system SHALL provide a guided setup flow where the owner configures: restaurant details, table map, operating hours, menu upload (PDF/photo/manual), policies, agent personality, loyalty program rules, and WhatsApp Business number connection.

#### Scenario: New restaurant onboarding
- **WHEN** a new restaurant owner starts setup
- **THEN** the system SHALL walk them through each configuration step, with sensible defaults for fields they skip
