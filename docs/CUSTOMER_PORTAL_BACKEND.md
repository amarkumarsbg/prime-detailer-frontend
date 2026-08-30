# Customer Portal - Backend Implementation Guide

**Status:** Frontend 100% complete ✅ | Backend implementation needed 🚀

## Overview

A complete read-only customer portal has been implemented on the frontend with 10 new TypeScript files, full type safety, mobile-first design, and all necessary UI components. The portal requires backend API endpoints to function.

**Key Principle:** All customer endpoints must enforce that authenticated users can only access their own data. Never trust customerId from frontend - always extract from JWT token claims.

---

## 1. Authentication Endpoints

### 1.1 POST `/api/auth/customer/login`

**Purpose:** Authenticate a customer and return JWT access token

**Request:**
```typescript
{
  phone: string;        // 10-digit phone number (e.g., "9876543210")
  password: string;     // Customer's password
}
```

**Response (Success - 200):**
```typescript
{
  data: {
    accessToken: string;  // JWT Bearer token
    user: {
      id: string;                    // User ID from auth_users table
      customerId: string;            // Customer ID from customers table
      name: string;                  // Customer's full name
      email: string;                 // Customer's email
      phone: string;                 // Customer's phone
      role: "CUSTOMER";              // Always "CUSTOMER"
      avatar?: string;               // Customer's avatar URL (optional)
      address?: string;              // Customer's address (optional)
      referralCode: string;          // Customer's referral code
      rewardPoints: number;          // Current reward points balance
      walletBalance: number;         // Current wallet balance in ₹
      lastVisitDate?: string;        // ISO date of last portal visit (optional)
    }
  }
}
```

**Response (Failure - 401):**
```typescript
{
  ok: false;
  message: "Invalid phone or password";
}
```

**Implementation Notes:**
- Validate phone format: exactly 10 digits
- Use bcrypt to verify password against customers table
- Generate JWT token with customerId in claims (used by other endpoints for authorization)
- Token expiration: 7 days (refresh tokens optional)
- Rate limit: 5 attempts per 15 minutes per phone to prevent brute force

---

### 1.2 GET `/api/auth/customer/me`

**Purpose:** Validate session and return current customer's profile

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```typescript
{
  data: {
    user: {
      id: string;                    // User ID
      customerId: string;            // Customer ID
      name: string;
      email: string;
      phone: string;
      role: "CUSTOMER";
      avatar?: string;
      address?: string;
      referralCode: string;
      rewardPoints: number;
      walletBalance: number;
      lastVisitDate?: string;
    }
  }
}
```

**Response (Failure - 401):**
```typescript
{
  ok: false;
  message: "Invalid or expired token";
}
```

**Implementation Notes:**
- Extract customerId from JWT token
- Verify token signature and expiration
- Return updated customer data (rewardPoints, walletBalance may have changed)
- Use this endpoint for session validation on every portal visit

---

## 2. Customer Data Endpoints

### 2.1 GET `/api/customer/bootstrap`

**Purpose:** Return all dashboard data for logged-in customer in one call (performance optimization)

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```typescript
{
  data: {
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string;
      address?: string;
      avatar?: string;
      referralCode: string;
      rewardPoints: number;
      walletBalance: number;
    },
    jobCards: JobCard[];      // All customer's job cards, sorted by createdAt desc
    invoices: Invoice[];      // All customer's invoices, sorted by createdAt desc
    vehicles: Vehicle[];      // All customer's vehicles
    memberships: CustomerMembership[];  // All customer's memberships
    walletTransactions: WalletTransaction[];  // Customer's wallet transaction history
    serviceHistory: JobCard[];  // Completed jobs (status DELIVERED or CANCELLED)
  }
}
```

**Implementation Notes:**
- Extract customerId from JWT token
- Filter all collections by customerId
- Include related data (memberships should include packageName from joined package table)
- For invoices, include full payments array (frontend calculates amountPaid)
- For job cards, include services array with service names
- Optionally include pagination or limit to last 100 items per collection
- Cache for 1 minute if feasible

---

### 2.2 GET `/api/customer/job-cards`

**Purpose:** List customer's job cards (fallback if bootstrap not used)

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?status=RECEIVED,IN_PROGRESS  // Optional: filter by comma-separated statuses
&limit=50                      // Optional: limit results (default 50)
&offset=0                      // Optional: pagination offset
```

**Response (Success - 200):**
```typescript
{
  data: {
    jobCards: JobCard[];
    total: number;
  }
}
```

**Implementation Notes:**
- Filter by authenticated customer's ID
- Sort by createdAt descending
- Return complete JobCard with services array populated
- Statuses: RECEIVED, INSPECTION, IN_PROGRESS, QC, READY, INVOICED, DELIVERED, CANCELLED

---

### 2.3 GET `/api/customer/invoices`

**Purpose:** List customer's invoices

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?status=ISSUED,PARTIALLY_PAID,PAID,OVERDUE  // Optional: filter by status
&limit=50
&offset=0
```

**Response (Success - 200):**
```typescript
{
  data: {
    invoices: Invoice[];
    total: number;
  }
}
```

**Implementation Notes:**
- Filter by customerId from JWT
- Include full payments array for each invoice (frontend calculates total paid)
- Statuses: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
- Sort by createdAt descending
- Include vehicleMakeModel for invoices without job cards (counter sales)

---

### 2.4 GET `/api/customer/vehicles`

**Purpose:** List customer's vehicles

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```typescript
{
  data: {
    vehicles: Vehicle[];
  }
}
```

**Response Fields Expected:**
```typescript
{
  id: string;
  registrationNumber: string;
  customerId: string;
  makeName: string;
  modelName: string;
  segment: VehicleSegment;     // "HATCHBACK" | "SEDAN" | "SUV" | "VAN" | "TRUCK"
  year: number;
  fuelType: "PETROL" | "DIESEL" | "CNG" | "HYBRID" | "ELECTRIC";
  color?: string;
}
```

**Implementation Notes:**
- Filter by customerId from JWT
- No sorting required (display in order retrieved)
- This is read-only (customers cannot add/edit vehicles from portal)

---

### 2.5 GET `/api/customer/memberships`

**Purpose:** Get customer's active and inactive memberships

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```typescript
{
  data: {
    memberships: Array<CustomerMembership & { packageName: string }>;
  }
}
```

**Implementation Notes:**
- Filter by customerId from JWT
- Include join with MembershipPackage table to add packageName
- Sort by endDate descending (active memberships first)
- This is critical for the "More" page section

---

### 2.6 GET `/api/customer/service-history`

**Purpose:** List customer's completed jobs

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
```
?limit=50
&offset=0
```

**Response (Success - 200):**
```typescript
{
  data: {
    serviceHistory: JobCard[];
    total: number;
  }
}
```

**Implementation Notes:**
- Filter by customerId and status IN ('DELIVERED', 'CANCELLED')
- Sort by actualDelivery descending (or createdAt if actualDelivery null)
- For use in future detail pages and service history view

---

### 2.7 GET `/api/customer/rewards`

**Purpose:** Get customer's reward points balance and history

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```typescript
{
  data: {
    balance: number;
    history: Array<{
      id: string;
      description: string;
      pointsEarned: number;      // Can be negative for redemptions
      earnedAt: string;           // ISO date
      relatedInvoiceId?: string;
      relatedRedemptionId?: string;
    }>;
  }
}
```

**Implementation Notes:**
- Extract customerId from JWT
- Balance = sum of all pointsEarned in history
- For future "Rewards Catalog" detail page

---

### 2.8 GET `/api/customer/wallet`

**Purpose:** Get customer's wallet balance and transaction history

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (Success - 200):**
```typescript
{
  data: {
    balance: number;             // Current wallet balance in ₹
    transactions: WalletTransaction[];
  }
}
```

**WalletTransaction Format:**
```typescript
{
  id: string;
  customerId: string;
  type: "CREDIT" | "DEBIT";
  amount: number;              // In ₹
  description: string;         // "Payment received", "Reward redemption", etc.
  createdAt: string;          // ISO date
  referenceId?: string;        // Related invoice or order ID
  balanceAfter: number;        // Wallet balance after this transaction
}
```

**Implementation Notes:**
- Filter by customerId from JWT
- Sort by createdAt descending (most recent first)
- Include last 50 transactions in response
- Balance = sum of all CREDIT amounts - sum of all DEBIT amounts

---

## 3. WhatsApp Customer Credentials Message

### Message Template

When a new customer account is created during the booking wizard, send this WhatsApp message:

```
Hi {firstName}! 🎉 Welcome to {businessName}!

Your booking {bookingReference} has been confirmed.

Here are your account credentials to track your service:

📱 Phone: {phone}
🔑 Password: {password}

Please log in at our customer portal to track your vehicle:
{customerPortalUrl}

Please change your password after first login for security.

Thank you for choosing {businessName}! 🚗
We look forward to serving you.
```

**Backend Changes Needed:**

1. **Customer Account Creation** (in booking-wizard flow)
   - Generate random 8-character password
   - Store hashed password in customers table
   - Return the plain password (only on creation, for WhatsApp message)
   - Example: `GenerateSecurePassword()` → "aBc123$!"

2. **WhatsApp Message Sending**
   - Trigger after successful account creation in booking wizard
   - Use existing WhatsApp integration
   - Template variables:
     ```
     firstName = customer.name.split(" ")[0]
     businessName = Get from settings/branch config
     bookingReference = booking.bookingId or appointment.bookingId
     phone = customer.phone
     password = (plain text, only available during creation)
     customerPortalUrl = https://app.yourdomain.com/customer/login
     ```

3. **Reference Implementation**
   - See: [src/lib/customer-credentials-whatsapp.ts](../src/lib/customer-credentials-whatsapp.ts)
   - Use: `buildCustomerCredentialsWhatsAppMessage()` function to format message
   - Use: `getCustomerPortalUrl()` to get the login URL

---

## 4. Main Login Page Route Update

**Frontend Change (Already Implemented):** `/app/(auth)/login/page.tsx`

```typescript
if (success) {
  const authUser = useAuthStore.getState().user;
  if (authUser?.role === "CUSTOMER") {
    window.location.assign("/customer/dashboard");  // ← Added this line
  } else if (authUser?.role === "PLATFORM_OWNER") {
    window.location.assign("/saas-admin/organizations");
  } else {
    window.location.assign("/dashboard");
  }
}
```

**Backend Change Needed:**

Update the main login endpoint at `POST /api/auth/login` to:
1. Check if user.role === "CUSTOMER"
2. Return CUSTOMER role in the response (already working if you return user.role)
3. Frontend will automatically redirect to `/customer/dashboard` for customers

---

## 5. Authorization Middleware

**Critical Security Pattern:**

```typescript
// Pseudo-code for backend middleware
async function authorizeCustomer(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // NEVER trust customerId from frontend
    // Extract from JWT token only
    req.user = {
      userId: decoded.sub,
      customerId: decoded.customerId,
      role: decoded.role
    };
    
    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ 
        ok: false, 
        message: "Customer role required" 
      });
    }
    
    // For endpoints with :customerId parameter
    if (req.params.customerId && req.params.customerId !== req.user.customerId) {
      return res.status(403).json({
        ok: false,
        message: "Cannot access other customer's data"
      });
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}
```

**Apply middleware to all customer routes:**
```typescript
router.use("/api/customer/*", authorizeCustomer);
router.use("/api/auth/customer/*", authenticateCustomer); // lighter validation
```

---

## 6. Implementation Checklist

### Phase 1: Authentication (Priority: CRITICAL)
- [ ] Add CUSTOMER to UserRole enum/type on backend
- [ ] Create `/api/auth/customer/login` endpoint
- [ ] Create `/api/auth/customer/me` endpoint
- [ ] Test: Login with phone + password → JWT token
- [ ] Test: Verify token with me endpoint
- [ ] Update main login `/api/auth/login` to work with CUSTOMER role

### Phase 2: Core API (Priority: CRITICAL)
- [ ] Create `/api/customer/bootstrap` endpoint (loads all dashboard data)
- [ ] Create authorization middleware for customer routes
- [ ] Create `/api/customer/job-cards` endpoint
- [ ] Create `/api/customer/invoices` endpoint
- [ ] Create `/api/customer/vehicles` endpoint
- [ ] Test: All endpoints filter by authenticated customer's ID

### Phase 3: Additional API (Priority: HIGH)
- [ ] Create `/api/customer/memberships` endpoint (with packageName join)
- [ ] Create `/api/customer/service-history` endpoint
- [ ] Create `/api/customer/rewards` endpoint
- [ ] Create `/api/customer/wallet` endpoint

### Phase 4: Account Creation (Priority: MEDIUM)
- [ ] Modify booking-wizard customer account creation to:
  - Generate random secure password
  - Store hashed password
  - Return plain password for WhatsApp
- [ ] Create WhatsApp message sending after customer account creation
- [ ] Use `buildCustomerCredentialsWhatsAppMessage()` from frontend lib

### Phase 5: Testing (Priority: HIGH)
- [ ] Login as customer A → see only customer A's data
- [ ] Login as customer B → try accessing customer A's invoice ID → 403 Forbidden
- [ ] Change invoice ID in URL → no access to other customer
- [ ] Test all endpoints return correct data structure
- [ ] Verify mobile app UI works with response data
- [ ] Test WhatsApp message formatting and content
- [ ] Verify password reset flow works for customers

### Phase 6: Security Audit (Priority: CRITICAL)
- [ ] All customer endpoints extract customerId from JWT only
- [ ] No customer endpoint accepts customerId from frontend
- [ ] All queries include WHERE customerId = :authenticatedCustomerId
- [ ] Rate limiting on login endpoint
- [ ] Password strength requirements enforced
- [ ] JWT expiration set appropriately

---

## 7. Frontend Status Summary

### ✅ Completed Files

1. **Authentication Store** - `src/store/customer-auth-store.ts`
   - Login, logout, session validation
   - Awaiting: `/api/auth/customer/login` & `/api/auth/customer/me`

2. **Dashboard Store** - `src/store/customer-dashboard-store.ts`
   - Bootstrap all customer data
   - Getters for current job, recent invoice, outstanding amount, etc.
   - Awaiting: `/api/customer/bootstrap`

3. **Login Page** - `src/app/customer/login/page.tsx`
   - Branded login form with phone input
   - Awaiting: `/api/auth/customer/login`

4. **Portal Layout** - `src/app/customer/layout.tsx`
   - Protected routes with session validation
   - Mobile bottom nav + desktop sidebar
   - Awaiting: Authentication endpoints

5. **Dashboard Pages**
   - Dashboard home - `src/app/customer/dashboard/page.tsx`
   - Jobs list - `src/app/customer/jobs/page.tsx`
   - Invoices - `src/app/customer/invoices/page.tsx`
   - Vehicles - `src/app/customer/vehicles/page.tsx`
   - More (profile, referral, rewards, wallet, memberships) - `src/app/customer/more/page.tsx`

6. **Helper** - `src/lib/customer-credentials-whatsapp.ts`
   - WhatsApp message formatting function

### ⏳ Pending (Backend Dependent)

1. Detail pages for jobs and invoices
2. Password change flow
3. Rewards catalog detail page
4. Service history detail page

---

## 8. Type Definitions

All TypeScript types are already defined in the frontend:

- `CustomerUser` - `src/types/auth.ts`
- `JobCard`, `Invoice`, `Vehicle`, `CustomerMembership`, `WalletTransaction` - `src/types/`
- These match your existing database models

---

## 9. Frequently Asked Questions

**Q: Why can't the frontend send customerId?**
A: The frontend is untrusted - a malicious user could modify it to access other customers' data. Always extract the customer ID from the JWT token (which is signed by your backend and verified on every request).

**Q: Should customers be able to edit anything?**
A: No. This is a READ-ONLY portal. All customer pages are display-only. Customers cannot:
- Edit job card details
- Modify invoice amounts
- Change vehicle information
- Delete anything
- Access staff/admin features

**Q: What about password reset?**
A: Create a separate flow (not in this PR). For now, admin can reset via staff panel or send new credentials via WhatsApp.

**Q: Can I cache bootstrap data?**
A: Yes, but keep cache short (1-2 minutes). Refresh when customer navigates away and back to ensure up-to-date data.

---

## 10. Deployment Notes

1. Set `NEXT_PUBLIC_APP_URL` environment variable (used by WhatsApp message template)
2. Update customer login form to use your actual API base URL
3. Test customer login before going live
4. Ensure WhatsApp integration is active
5. Backup customer data before deploying (create customer accounts in production)

---

## Backend Changes Required

**🚀 Backend Changes Required (Critical):**

1. **Authentication Endpoints (NEW)**
   - POST /api/auth/customer/login
   - GET /api/auth/customer/me

2. **Customer Data Endpoints (NEW)**
   - GET /api/customer/bootstrap (PRIMARY)
   - GET /api/customer/job-cards (optional, bootstrap is sufficient)
   - GET /api/customer/invoices (optional, bootstrap is sufficient)
   - GET /api/customer/vehicles (optional, bootstrap is sufficient)
   - GET /api/customer/memberships
   - GET /api/customer/service-history (future)
   - GET /api/customer/rewards (future)
   - GET /api/customer/wallet (future)

3. **Authorization Middleware**
   - Customer-only routes with JWT validation
   - Extract customerId from token, filter all queries by it
   - Never trust frontend parameters

4. **Account Creation Flow**
   - Generate password during customer account creation
   - Send credentials via WhatsApp to customer

5. **Main Login Update**
   - Route CUSTOMER role to /customer/dashboard (frontend ready)

---

**Frontend is 100% complete and ready. Backend implementation is the only blocker.**
