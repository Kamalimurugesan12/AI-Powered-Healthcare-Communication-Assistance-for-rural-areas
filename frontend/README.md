# 🩺 Healthcare Assistant Frontend

Frontend for the **AI-Powered Healthcare Communication Assistant for Rural Communities** developed during the Infosys Springboard Internship.



https://github.com/user-attachments/assets/a2e8bf3e-712a-4ca7-9b55-6a72081ea638



---

# Team Structure

| Module | Owner |
|---------|-------|
| Landing Page | Sanskruti |
| Authentication | Amrutha |
| Home  | Hyndavi |
| Upload + OCR Preview| Divya |
| AI Results | Santosh |
| History | Yasaswini |
| Frontend Architecture & Integration & Profile| Nipun |

---

# Tech Stack

- React + Vite
- Tailwind CSS
- shadcn/ui
- Lucide React
- React Router
- Axios

---

# Getting Started

## 1. Clone the repository

```bash
git clone <repo-url>
```

---

## 2. Switch to frontend branch

```bash
git checkout frontend
```

---

## 3. Install dependencies

```bash
npm install
```

---

## 4. Create environment file

Create a `.env` file in the project root.

Example:

```env
VITE_API_URL=http://localhost:8000/api
```

---

## 5. Run

```bash
npm run dev
```

---

# Folder Structure

```
src/
│
├── assets/
├── components/
│   ├── cards/
│   ├── common/
│   ├── layout/
│   └── ui/
│
├── constants/
├── contexts/
├── hooks/
├── pages/
├── routes/
├── services/
├── styles/
├── utils/
│
├── App.jsx
├── main.jsx
└── index.css
```

---

# Component Guidelines

## UI Components

`components/ui`

Contains **shadcn/ui** components only.

Examples:

- Button
- Input
- Card
- Tabs
- Select
- Badge
- Alert

Do **not** modify these unless necessary.

---

## Common Components

`components/common`

Reusable project-specific components.

Examples:

- Loader
- EmptyState
- StatusBadge
- ErrorMessage
- LanguageChip
- PageHeader

Use these instead of creating duplicates.

```jsx
import Loader from "@/components/common/Loader";
import EmptyState from "@/components/common/EmptyState";
import ErrorMessage from "@/components/common/ErrorMessage";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import LanguageChip from "@/components/common/LanguageChip";
```

---

## Cards

`components/cards`

Reusable card layouts.

Examples:

- PrescriptionCard
- HistoryCard
- ResultCard

```jsx
import HistoryCard from "@/components/cards/HistoryCard";
import PrescriptionCard from "@/components/cards/PrescriptionCard";
import ResultCard from "@/components/cards/ResultCard";
```

---

## Layout Components

`components/layout`

Contains shared layout elements.

Examples:

- Navbar
- BottomNav
- Footer
- Sidebar

```jsx
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
```

---

# Styling Rules

✅ Use Tailwind classes

✅ Use semantic theme colors

Examples

```jsx
bg-primary
bg-card
text-foreground
text-muted-foreground
```

Avoid

```jsx
bg-blue-500
text-green-700
style={{}}
```

---

# Icons

Use **Lucide React** only.

```jsx
import { Upload } from "lucide-react";
```

---

# Fonts

Heading

Fraunces

Body

Inter

---

# Routing

Pages belong inside

```
src/pages/
```

Routes are managed inside

```
src/routes/
```

Do not hardcode navigation.

---

# API Calls

Never call Axios directly inside components.

Instead:

```
services/
```

Example

```jsx
authService.login()

historyService.getHistory()

profileService.updateProfile()
```

---

# API Endpoints

Store endpoint URLs inside

```
constants/api.js
```

Example

```js
LOGIN

REGISTER

PROCESS

PROFILE

HISTORY
```

Never hardcode URLs.

---

# Constants

Store

- routes
- endpoints
- application name

inside

```
constants/
```

---

# Team Workflow

Always start from the latest frontend branch.

```bash
git checkout frontend
git pull origin frontend
```

Create your feature branch.

```bash
git checkout -b feature/<module-name>
```

Examples

```
feature/auth

feature/upload

feature/results

feature/history

feature/home
```

Commit

```bash
git add .

git commit -m "feat: implement authentication page"
```

Push

```bash
git push origin feature/auth
```

Create a Pull Request into

```
frontend
```

---

# Coding Standards

✔ Functional Components

✔ Hooks

✔ Reusable Components

✔ Responsive Design

✔ Mobile First

✔ Semantic Tailwind Classes

✔ Clean Folder Structure

---

# Do NOT

❌ Create duplicate components

❌ Hardcode API URLs

❌ Hardcode colors

❌ Modify shared components unnecessarily

❌ Push directly to `main`

❌ Commit `.env`

---

# Documentation

Please read:

- ARCHITECTURE.md
- CONTRIBUTING.md
- DESIGN.md

before starting development.

---

# Need Help?

If you're unsure where a component belongs or need a shared component added, contact the frontend lead before creating a new folder or duplicate component.
