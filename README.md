# DwarPal - Digital Gatepass System

A modern, responsive frontend for a college digital gatepass system built with React.js.

## Features

- **Role-based Dashboards**: Student, Faculty, Principal, HOD, CAO, Security
- **Complete Gatepass Flow**: From submission to approval and security marking
- **Responsive Design**: Works on web and mobile
- **Modern UI**: Clean, professional interface with smooth animations
- **Mock Data**: Frontend-only simulation of the entire system

## Tech Stack

- React 18
- React Router DOM
- Lucide React (icons)
- Vite (build tool)
- Tailwind CSS (utility classes)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Project Structure

```
src/
├── components/
│   ├── Splash.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── StudentDashboard.jsx
│   ├── FacultyDashboard.jsx
│   ├── PrincipalDashboard.jsx
│   ├── HodDashboard.jsx
│   ├── CaoDashboard.jsx
│   ├── SecurityDashboard.jsx
│   ├── Profile.jsx
│   └── CreateGatepass.jsx
├── mockData.js
├── App.jsx
├── App.css
├── main.jsx
└── index.css
```

## User Roles & Credentials

### Students
- John Doe: enrollment `2021001`, password `password123`
- Jane Smith: enrollment `2021002`, password `password123`

### Faculty
- Dr. Robert Johnson: employeeId `FAC001`, password `password123`

### Admin Roles
- Principal Williams: employeeId `PRI001`, password `password123`
- Dr. HOD Brown: employeeId `HOD001`, password `password123`
- CAO Davis: employeeId `CAO001`, password `password123`
- Security Guard: employeeId `SEC001`, password `password123`

## Gatepass Flow

1. **Student/Faculty** submits gatepass
2. **Principal** reviews student requests (approve/reject/send to HOD)
3. **HOD** reviews forwarded requests (approve/reject)
4. **CAO** reviews faculty requests (approve/reject)
5. **Security** marks approved gatepasses OUT/IN

## Features Implemented

- ✅ Splash screen with branding
- ✅ Login/Register with validation
- ✅ Role-based routing and dashboards
- ✅ Gatepass creation modal
- ✅ Status tracking with color-coded badges
- ✅ Search functionality across dashboards
- ✅ Responsive grid layouts
- ✅ Modern card-based UI
- ✅ Notification icons (UI only)
- ✅ Profile screen
- ✅ Logout functionality
- ✅ Mock data simulation

## Status Badges

- **Pending**: Orange
- **Approved**: Green
- **Rejected**: Red
- **Out**: Blue
- **Returned**: Gray

## Mobile Responsive

The app is fully responsive with:
- Mobile-first design
- Touch-friendly buttons
- Collapsible navigation
- Optimized layouts for small screens

## Future Enhancements

- Real-time notifications
- QR code generation for gatepasses
- Dark mode toggle
- Advanced filtering
- Export functionality
- Backend integration

## License

This project is for educational purposes.