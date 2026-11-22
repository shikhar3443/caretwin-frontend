# CareTwin Frontend 🌐🩺
### *Modern, AI-Enhanced Personal Healthcare Dashboard & Emergency Response System*

[![Live Demo](https://img.shields.io/badge/Live_Demo-caretwin--frontend.vercel.app-0070F3.svg?style=for-the-badge&logo=vercel)](https://caretwin-frontend.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black.svg?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

> 🚀 **Live Production Application:** [https://caretwin-frontend.vercel.app/](https://caretwin-frontend.vercel.app/)  
> 🔗 **Connected Live API (Render):** [https://caretwin-backend-qkql.onrender.com/docs](https://caretwin-backend-qkql.onrender.com/docs)

---

## 🌟 Overview

**CareTwin Frontend** is the user-facing web application of the CareTwin healthcare platform. Built using **Next.js (App Router)** and **Tailwind CSS**, it empowers patients and families to effortlessly organize medical documents, track biomarker trends, access AI-driven clinical risk assessments, and instantly deploy emergency QR cards for first responders.

---

## ✨ Features & Modules

### 1. 📊 Interactive Patient Dashboard
- **Real-Time Health Vitals**: Visual overview of latest blood pressure, glucose, hemoglobin, and lab metrics.
- **Family Profile Switcher**: Toggle seamlessly between family members, dependents, and personal health profiles.
- **Biomarker Trend Visualizer**: Graphical view of clinical readings over time with normal reference range indicators.

### 2. 🗂️ Medical Record Locker & OCR Hub
- **Drag-and-Drop Upload**: Fast file intake supporting medical PDFs, scanned reports, and lab images.
- **Automated Clinical Extraction**: Displays real-time status of OCR extraction with structured lab parameters (CBC, LFT, KFT, Lipids).
- **Medical Entity Extraction**: Clear extraction cards for diagnosed conditions and active prescription regimens.

### 3. 🤖 AI Clinical Mortality & Risk Predictor
- **Interactive Risk Assessor**: Integrates directly with the backend's trained XGBoost model.
- **Pre-populated Vitals**: Automatically pulls latest patient lab values into the ML prediction form.
- **Clear Risk Visualization**: Visual probability gauges, clinical severity tiers (`Lower Risk`, `Moderate`, `High`), and actionable medical recommendations.

### 4. 🚨 Emergency QR Profile & Resuscitation Card
- **Personal Emergency ID**: Configure blood group, critical allergies, chronic conditions, and emergency contact numbers.
- **Instant QR Code**: High-resolution scannable QR code generator for lock screens, physical cards, and keychains.
- **First-Responder Public View (`/emergency/[token]`)**: Lightweight, ultra-fast mobile landing page enabling EMTs and doctors to access life-saving health data without requiring login credentials.

### 5. 💬 AI Medical Chat & Symptom Exploration
- Conversational health exploration assistant with guided medical disclaimers.
- Fast symptom triage and clinical guidance to inform doctor visits.

---

## 🏗️ Project Architecture

```
caretwin-frontend/
├── app/
│   ├── (auth)/                 # Login & Registration views
│   │   ├── login/
│   │   └── signup/
│   ├── (website)/              # Public landing, HIPAA compliance, company pages
│   ├── dashboard/              # Protected patient portal
│   │   ├── ai-chat/            # AI health assistant
│   │   ├── emergency/          # Emergency QR generator & profile
│   │   ├── family/             # Family member management
│   │   ├── medical-records/    # File locker & OCR viewer
│   │   ├── mortality-risk/     # XGBoost ML risk prediction page
│   │   ├── reports/            # Detailed health trends & metrics
│   │   ├── settings/           # Account & notification preferences
│   │   └── symptom-checker/    # Interactive symptom checker
│   ├── emergency/              # Public first-responder emergency card
│   ├── layout.tsx              # Root app layout & font definitions
│   └── page.tsx                # High-conversion public landing page
├── components/
│   ├── Dashboard/              # Modular dashboard widgets & trend charts
│   ├── hero/                   # Landing page hero & animations
│   ├── shared/                 # Navbar, footer, and navigation bars
│   └── ui/                     # Reusable design system primitives
├── lib/
│   ├── api.ts                  # Type-safe FastAPI client & fetch wrapper
│   ├── types.ts                # TypeScript interfaces (Records, Family, ML, QR)
│   └── useCareData.ts          # Centralized client-side state provider
└── public/                     # Static assets, branding, and icons
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Framer Motion
- **Icons**: Lucide React
- **Typography**: Geist Sans & Geist Mono (Vercel)
- **Utilities**: `clsx`, `tailwind-merge`, `qrcode`

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.17+ or 20+
- npm, pnpm, or yarn

### 2. Installation
```bash
git clone https://github.com/shikhar3443/caretwin-frontend.git
cd caretwin-frontend

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root folder:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```
> **Note**: In production, replace `http://localhost:8000` with your deployed backend URL (e.g., on Render or Railway).

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 🔗 Connected Repositories
- **Backend Service (FastAPI + ML + OCR)**: [shikhar3443/caretwin_backend](https://github.com/shikhar3443/caretwin_backend)

---

## 👥 Contributors & Acknowledgements
- **Frontend Architecture & Integration**: [@shikhar3443](https://github.com/shikhar3443)
- **UI Design & Upstream Collaboration**: [@rohitsingh15072005](https://github.com/rohitsingh15072005)
