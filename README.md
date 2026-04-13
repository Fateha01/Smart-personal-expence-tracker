# Expensio — Smart Personal Expense Tracker

A full-stack personal finance tracker with a beautiful dark-mode frontend and a secure Node.js/Express backend connected to **MongoDB Atlas**.

---

## 📁 Project Structure

```
Smart-personal-expence-tracker/
│
├── index.html          # Single-page frontend
├── style.css           # All frontend styles
├── script.js           # Frontend logic (localStorage mode)
├── api.js              # Frontend API client (backend mode)
│
└── backend/
    ├── server.js               # Express entry point
    ├── .env                    # Environment variables (MongoDB URI, JWT)
    ├── .gitignore
    ├── package.json
    │
    ├── config/
    │   └── db.js               # Mongoose connection helper
    │
    ├── models/
    │   ├── User.model.js        # User schema (bcrypt, roles)
    │   ├── Transaction.model.js # Transaction schema (indexes)
    │   └── Budget.model.js      # Monthly budget schema
    │
    ├── middleware/
    │   ├── auth.middleware.js    # JWT protect + adminOnly
    │   ├── error.middleware.js   # Global error + 404 handler
    │   ├── validate.middleware.js# Input validation + XSS sanitisation
    │   └── rateLimit.middleware.js# API + auth rate limiters
    │
    ├── controllers/
    │   ├── auth.controller.js        # register, login, me, changePassword
    │   ├── transaction.controller.js # CRUD + summary + monthly aggregations
    │   ├── budget.controller.js      # get, upsert, delete
    │   └── admin.controller.js       # stats, user management, reset
    │
    ├── routes/
    │   ├── auth.routes.js
    │   ├── transaction.routes.js
    │   ├── budget.routes.js
    │   └── admin.routes.js
    │
    └── scripts/
        └── seed.js             # Demo data seeder
```

---

## 🚀 Getting Started

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

The `.env` file is pre-configured with your MongoDB Atlas connection string:

```env
MONGO_URI=mongodb+srv://fatehasumaya139_db_user:...@mudevarchive.axeexs9.mongodb.net/expensio
JWT_SECRET=expensio_super_secret_jwt_key_2026
PORT=5000
```

### 3. Seed demo data (optional)

```bash
cd backend
npm run seed
```

Creates:
- **Admin** → `admin / admin123`
- **Demo User** → `user / user123`
- 20 sample transactions + monthly budgets

### 4. Start the backend

```bash
# Development (auto-restart)
cd backend
npm run dev

# Production
npm start
```

API runs at → **http://localhost:5000**

### 5. Open the frontend

Open `index.html` via **Live Server** (VS Code) or any HTTP server on port 5500.

> The `api.js` file is included in `index.html` and provides `window.ExpensioAPI` for backend integration.

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user |
| PUT | `/api/auth/me` | ✅ | Update profile |
| PUT | `/api/auth/change-password` | ✅ | Change password |
| GET | `/api/transactions` | ✅ | List (filterable) |
| POST | `/api/transactions` | ✅ | Create transaction |
| PUT | `/api/transactions/:id` | ✅ | Update transaction |
| DELETE | `/api/transactions/:id` | ✅ | Delete transaction |
| GET | `/api/transactions/summary` | ✅ | Income/expense totals |
| GET | `/api/transactions/by-category` | ✅ | Expense by category |
| GET | `/api/transactions/monthly?year=` | ✅ | Monthly breakdown |
| GET | `/api/budgets` | ✅ | Get budget + spent |
| PUT | `/api/budgets` | ✅ | Save/update budget |
| DELETE | `/api/budgets` | ✅ | Clear budget |
| GET | `/api/admin/stats` | 🔐 Admin | System-wide stats |
| GET | `/api/admin/users` | 🔐 Admin | All users list |
| PATCH | `/api/admin/users/:id/role` | 🔐 Admin | Change user role |
| DELETE | `/api/admin/users/:id` | 🔐 Admin | Delete user + data |
| DELETE | `/api/admin/reset-all` | 🔐 Admin | Wipe all data |

---

## 🛡️ Security Features

- **JWT Authentication** with 7-day expiry
- **bcrypt** password hashing (12 salt rounds)
- **Helmet** HTTP security headers
- **Rate limiting** — 20 req/15min for auth, 200 req/15min for API
- **Input validation & XSS sanitisation** on all endpoints
- **Admin role guard** on all admin routes
- **Cascade delete** — deleting a user removes all their data

---

## 🗄️ MongoDB Atlas Connection

```
mongodb+srv://fatehasumaya139_db_user:***@mudevarchive.axeexs9.mongodb.net/expensio
```

Database name: **expensio**  
Collections: `users`, `transactions`, `budgets`
