# AI Sleep Schedule Builder Backend

A Node.js backend API for building AI-powered sleep schedules, built with Hono, TypeScript, and PostgreSQL.

## Features

- 🔐 User authentication with email verification
- 💳 Stripe integration for subscription management
- 📧 Email notifications via Nodemailer
- 📊 PDF generation for sleep schedules
- 🎯 Access control based on subscription tiers
- 🗄️ PostgreSQL database with Drizzle ORM

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: [Hono](https://hono.dev/) - Fast web framework
- **Language**: TypeScript
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: Session-based with bcrypt
- **Payments**: [Stripe](https://stripe.com/)
- **Email**: [Nodemailer](https://nodemailer.com/)
- **PDF Generation**: [PDF-lib](https://pdf-lib.js.org/)

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Stripe account
- SMTP email service (Gmail, Mailtrap, etc.)

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/sleep_schedule_db

# Server
PORT=3000
FRONTEND_URL=http://localhost:5175

# Stripe
STRIPE_API_KEY=sk_test_...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sleep-schedule-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables in `.env`

4. Run database migrations (if using Drizzle migrations)

## Development

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Type checking
npm run type-check

# Build (if needed)
npm run build
```

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/verify-email/:token` - Email verification

### User
- `GET /me` - Get current user profile

### Schedules
- `GET /schedule` - Get user schedules
- `POST /schedule` - Create new schedule

### Plans
- `GET /plans` - Get user plans
- `POST /plans` - Create new plan

### PDF Export
- `POST /pdf/generate` - Generate PDF schedule

### Stripe
- `POST /stripe/create-checkout` - Create checkout session
- `POST /stripe/create-portal` - Create customer portal session
- `POST /stripe-webhook` - Stripe webhook handler

## Database Schema

### Users Table
- `id` - Primary key
- `email` - User email (unique)
- `passwordHash` - Hashed password
- `stripeCustomerId` - Stripe customer ID
- `subscriptionTier` - free/basic/premium
- `subscriptionStatus` - active/inactive/canceled
- `exportCredits` - Available PDF export credits
- `emailVerified` - Email verification status

### Plans Table
- `id` - Primary key
- `userId` - User ID (foreign key)
- `markdown` - Plan content in markdown
- `babyAgeMonths` - Baby's age in months
- `createdAt` - Creation timestamp

## Project Structure

```
src/
├── db/           # Database configuration and schema
├── lib/          # Utility libraries (email, stripe)
├── middleware/   # Authentication and access control
├── routes/       # API route handlers
├── types.ts      # TypeScript type definitions
└── index.ts      # Main application entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
