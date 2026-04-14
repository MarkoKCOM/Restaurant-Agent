## NEW Requirements

### Requirement: Pilot sandbox tenant provisioning
The platform SHALL support provisioning a clean sandbox tenant for pilot testing without copying live operational data from the source restaurant.

#### Scenario: Provision a clean sandbox from an existing pilot tenant
- GIVEN an operator selects an existing restaurant as the sandbox baseline
- WHEN the sandbox provisioner creates a new tenant
- THEN the new tenant SHALL inherit baseline restaurant configuration needed for dashboard and booking operation
- AND the new tenant SHALL NOT inherit guests, reservations, waitlist entries, conversations, rewards, reward claims, campaigns, or loyalty transactions from the source tenant

#### Scenario: Sandbox includes a working admin login
- GIVEN a sandbox tenant is provisioned
- WHEN the provisioner completes
- THEN the sandbox SHALL have a restaurant-scoped admin login tied to that tenant
- AND that login SHALL authenticate successfully against dashboard auth

#### Scenario: Sandbox can be reset for repeated pilot runs
- GIVEN a sandbox tenant already exists
- WHEN the provisioner is rerun with reset enabled
- THEN sandbox operational data SHALL be cleared
- AND the tenant SHALL remain structurally usable for another onboarding/demo pass
