# Feature Specification: Construction Operations Workspace

**Feature Branch**: `main` (no feature branch was created)

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "this is going to be an app do see people management for a construction site, we arge going to have a products section, like hammer, drill... one constructions this is going to be a construction site list for differents construction employee app, financial app for data visualize and costs and savings... crm, SaaS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Construction Sites (Priority: P1)

A company administrator views the company's construction sites, adds a site, and opens its summary
so work can be organized by location. This is the initial usable workspace and anchor for the other
modules.

**Why this priority**: People, costs, and site-level reporting need a clear construction-site context.

**Independent Test**: Add two sites, locate one by name, open its details, and confirm that another
company's sites are not listed.

**Acceptance Scenarios**:

1. **Given** an administrator in a company with no sites, **When** they open Sites, **Then** an empty
   state explains how to add the first site.
2. **Given** an administrator adds a site with a name and location, **When** they return to Sites,
   **Then** the new site appears in the company list and opens to its own summary.
3. **Given** two companies have sites, **When** a member of one company opens Sites, **Then** only
   that company's sites are visible.
4. **Given** a site exists, **When** an administrator changes its location, **Then** the updated
   location appears in the site list and summary.
5. **Given** a member opens Sites on a narrow mobile screen or with reduced motion enabled, **When**
   they navigate to a site, **Then** the list and summary remain readable and navigation is not
   delayed by animation.

---

### User Story 2 - Manage People and Site Assignments (Priority: P2)

A company administrator maintains an employee directory and assigns employees to one or more sites.
An employee sees the sites assigned to them, providing a useful employee-facing view within the same
product.

**Why this priority**: Site teams need to know who belongs to each active site.

**Independent Test**: Add an employee, assign them to a site, and verify that the site roster and the
employee's assigned-site view agree.

**Acceptance Scenarios**:

1. **Given** a site exists, **When** an administrator adds an employee and assigns them to that site,
   **Then** the employee appears in the company directory and the site's roster.
2. **Given** an employee is assigned to two sites, **When** they open their assigned-site view,
   **Then** both sites appear and unrelated sites do not.
3. **Given** an administrator removes an assignment, **When** either view is reopened, **Then** the
   former assignment is no longer shown without deleting the employee record.
4. **Given** an employee record exists, **When** an administrator updates its work contact, **Then**
   the directory and employee detail show the new contact.

---

### User Story 3 - Browse and Maintain Products (Priority: P3)

A company administrator maintains a simple catalogue of construction products and tools, such as
hammers and drills. Company members can find a product and read its basic description.

**Why this priority**: A common product list establishes consistent names for items used by the
company without assuming stock, purchasing, or checkout workflows.

**Independent Test**: Add a hammer and a drill, find the drill by name, and verify its details.

**Acceptance Scenarios**:

1. **Given** an empty catalogue, **When** an administrator adds a product with a name and category,
   **Then** the product appears in the company's Products list.
2. **Given** multiple products, **When** a member searches for "drill", **Then** matching products
   appear and can be opened for details.
3. **Given** a product exists, **When** an administrator updates its description, **Then** the
   updated description appears in product details.

---

### User Story 4 - Understand Costs and Savings (Priority: P4)

An administrator records a site's planned budget and cost entries, then views totals and a simple
visual comparison. Savings means planned budget minus recorded costs; a negative result is shown as
an overrun, not as savings.

**Why this priority**: Construction leaders need a quick, understandable view of financial position
by site and across the company.

**Independent Test**: Set a site budget, record two costs, and verify the displayed cost total and
savings or overrun calculation for that site and the company total.

**Acceptance Scenarios**:

1. **Given** a site has a planned budget of 1,000 and costs of 300 and 200 in one currency,
   **When** an administrator opens Finance, **Then** the site shows costs of 500 and savings of 500.
2. **Given** a site has a planned budget of 1,000 and recorded costs of 1,200, **When** Finance is
   opened, **Then** the site shows an overrun of 200 rather than positive savings.
3. **Given** a site has no budget or cost data, **When** Finance is opened, **Then** missing values
   are identified rather than presented as zero savings.
4. **Given** multiple sites have budgets and costs, **When** Finance is opened, **Then** the company
   total reflects those sites and displays the reporting period and currency.

---

### User Story 5 - Track Customer Relationships (Priority: P5)

A company administrator keeps a simple CRM list of customers and prospective customers, records a
contact person, and tracks a lead's current stage. The administrator can associate a customer with
a site where relevant.

**Why this priority**: The company needs one place to follow customer relationships alongside work
in progress, without introducing sales automation in the first release.

**Independent Test**: Add a prospective customer, change its stage, associate it with a site, and
find it again in the CRM list.

**Acceptance Scenarios**:

1. **Given** an empty CRM list, **When** an administrator adds a prospect with a name and contact
   detail, **Then** it appears with a visible stage.
2. **Given** a prospect exists, **When** its stage is updated, **Then** the new stage appears in the
   list and detail view.
3. **Given** a customer is linked to a site, **When** that site is opened, **Then** the customer
   relationship is visible without exposing another company's CRM records.
4. **Given** multiple CRM records exist, **When** an administrator searches by customer name,
   **Then** matching records appear and an edited contact detail remains visible in the result.

### Edge Cases

- Duplicate employee, site, product, or customer names are allowed only when records remain
  distinguishable by their details; the UI must not silently merge them.
- A site with no assigned employees, products, financial data, or customer link shows a clear empty
  state rather than a misleading zero or broken chart.
- Removing an employee-site assignment does not delete the employee or the site.
- Financial totals use one declared currency per company; values in another currency are not silently
  added to the same total.
- If an expected data set cannot be loaded or is invalid, the affected view shows an error and does
  not present stale or partial data as current.
- A member without access to another company cannot discover that company's records through lists,
  details, search, or direct links.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST present each company as a separate workspace, and members MUST see
  only records belonging to companies they are authorized to access.
- **FR-002**: The product MUST provide a consistent navigation path to Sites, People, Products,
  Finance, and CRM within the current company workspace.
- **FR-003**: Administrators MUST be able to add and edit a site with a name and location, list the
  company's sites, find one by name, and open its summary.
- **FR-004**: Administrators MUST be able to add and edit employee records with a name and work
  contact, list employees, and assign or remove employees from sites without deleting either record.
- **FR-005**: Employees MUST be able to view their own assigned sites; they MUST NOT see unrelated
  sites or company financial and CRM data by default.
- **FR-006**: Administrators MUST be able to add and edit products with a name, category, and optional
  description; company members MUST be able to list, search, and view those products.
- **FR-007**: Administrators MUST be able to record one planned budget per site and cost entries with
  an amount, date, and description in the company's declared currency.
- **FR-008**: Finance MUST display site and company cost totals and compare planned budget with
  recorded costs; positive differences MUST be labeled savings and negative differences overruns.
- **FR-009**: Finance MUST distinguish missing budget or cost data from recorded zero values and
  identify the period and currency of displayed figures.
- **FR-010**: Administrators MUST be able to add and edit CRM records with a customer or prospect
  name, contact detail, stage, and optional linked site; they MUST be able to list and find records.
- **FR-011**: Lists and detail views MUST reflect updates to their underlying records and show
  explicit loading, empty, and error states where applicable.
- **FR-012**: The product MUST use a simple, consistent blue visual system and brief, non-blocking
  motion that does not prevent users from reaching data.
- **FR-013**: Navigation and data views MUST remain usable on desktop and narrow mobile screens.

### Key Entities *(include if feature involves data)*

- **Company workspace**: A subscribing construction company; owns sites, employees, products,
  financial records, and CRM records and defines the boundary between companies.
- **Workspace member**: A person with access to a company workspace, identified as an administrator
  or employee for this initial scope.
- **Construction site**: A named work location within one company; relates to employees, budgets,
  costs, and optionally CRM customers.
- **Employee**: A worker profile belonging to one company; may be assigned to multiple sites.
- **Site assignment**: The relationship between one employee and one site; removing it preserves
  both records.
- **Product**: A company catalogue item such as a hammer or drill, with a category and description.
- **Site budget**: The planned cost amount for a site in the company's declared currency.
- **Cost entry**: A dated expense attributed to a site and included in financial totals.
- **CRM record**: A customer or prospect with contact details, stage, and an optional site link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability test, at least 90% of administrators can add a site and find it again
  in under 2 minutes without assistance.
- **SC-002**: At least 90% of administrators can add an employee and assign them to an existing site
  in under 3 minutes without assistance.
- **SC-003**: At least 90% of company members can find a named product among 100 catalogue items in
  under 30 seconds.
- **SC-004**: For the sample budget and costs in User Story 4, every displayed site and company total
  matches the expected arithmetic, including overrun labeling and missing-data handling.
- **SC-005**: At least 90% of administrators can identify a site's cost total and budget difference
  in under 30 seconds, without confusing savings with overruns.
- **SC-006**: At least 90% of administrators can add a CRM prospect and locate its current stage in
  under 2 minutes without assistance.
- **SC-007**: In cross-company access tests, no record from one company appears in another company's
  lists, search results, detail views, or direct links.
- **SC-008**: With 100 sites and 1,000 employees in a company, users can find a named site or
  employee in under 5 seconds on a typical broadband connection.
- **SC-009**: In a usability review, at least 80% of participants rate the clarity of navigation
  and financial labels at least 4 out of 5.

## Assumptions

- This is one multi-company SaaS product with several modules, not separate products for each area.
- The employee-facing experience is a view within the same product, not a separate mobile application.
- For the initial scope, administrators manage records; employees can view their own site assignments
  and the company product catalogue. More granular roles require a later specification.
- The Products section is a catalogue, not stock tracking, purchasing, or tool checkout.
- "Savings" is planned site budget minus recorded costs; this is an operational comparison, not an
  accounting or profit calculation. A company uses one declared currency for this initial scope.
- Finance begins with manually recorded budgets and costs; payroll, invoices, taxes, payments,
  forecasts, and accounting-system integrations are outside this specification.
- CRM begins with customer/prospect records and stages; marketing automation and sales forecasts are
  outside this specification.
- Subscription billing and plan enforcement are outside this initial workspace specification, though
  company data separation is required for the SaaS model.
- Product-wide interface and integration choices remain governed by the project constitution.
