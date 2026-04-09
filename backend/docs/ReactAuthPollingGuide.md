# React Auth And Polling Guide

This guide shows how to connect the DwarPal backend to a React frontend with:

- protected routes
- public-only routes for `/login` and `/register`
- role-based dashboard access
- safe back-button behavior
- auth restoration on refresh
- logout cleanup
- 10-second polling for dashboards and notifications
- latest-response-only protection to avoid stale UI overwrites

## 1. Route Mapping

If your frontend uses separate dashboard routes, use a role map like this:

```js
export const ROLE_HOME_PATH = {
  student: '/student-dashboard',
  faculty: '/faculty-dashboard',
  principal: '/principal-dashboard',
  hod: '/hod-dashboard',
  cao: '/cao-dashboard',
  security: '/security-dashboard'
};

export function getHomePathForRole(role) {
  return ROLE_HOME_PATH[role] || '/login';
}
```

If you keep your current unified route like `/app/dashboard`, return that path instead and render the correct dashboard by `user.role`.

## 2. Axios Client With Auth Interceptors

```js
// src/lib/apiClient.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true
});

let onAuthFailure = null;

export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dwarpal_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dwarpal_token');

      if (onAuthFailure) {
        onAuthFailure();
      } else {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

## 3. Auth Provider With Restore-On-Refresh

```jsx
// src/auth/AuthProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setAuthFailureHandler } from '../lib/apiClient';
import { getHomePathForRole } from './rolePaths';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
      localStorage.removeItem('dwarpal_token');
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    let ignore = false;

    async function restoreAuth() {
      const token = localStorage.getItem('dwarpal_token');

      if (!token) {
        if (!ignore) setAuthReady(true);
        return;
      }

      try {
        const response = await api.get('/auth/verify');

        if (!ignore) {
          setUser(response.data.data.user);
        }
      } catch (error) {
        localStorage.removeItem('dwarpal_token');

        if (!ignore) {
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setAuthReady(true);
        }
      }
    }

    restoreAuth();

    return () => {
      ignore = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      authReady,
      user,
      isAuthenticated: Boolean(user),
      async login(payload) {
        const response = await api.post('/auth/login', payload);
        const { token, user: loggedInUser } = response.data.data;

        localStorage.setItem('dwarpal_token', token);
        setUser(loggedInUser);

        return loggedInUser;
      },
      async register(payload) {
        const response = await api.post('/auth/register', payload);
        const { token, user: registeredUser } = response.data.data;

        localStorage.setItem('dwarpal_token', token);
        setUser(registeredUser);

        return registeredUser;
      },
      async logout() {
        try {
          await api.post('/auth/logout');
        } finally {
          localStorage.removeItem('dwarpal_token');
          setUser(null);
        }
      },
      getHomePathForRole
    }),
    [authReady, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
```

## 4. Public Route Guard

Already-logged-in users must not stay on `/login` or `/register`.

```jsx
// src/auth/PublicOnlyRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function PublicOnlyRoute() {
  const { authReady, isAuthenticated, user, getHomePathForRole } = useAuth();

  if (!authReady) return <div>Loading...</div>;

  if (isAuthenticated) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
```

## 5. Protected Route Guard

Unauthenticated users must be redirected to `/login`.

```jsx
// src/auth/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const location = useLocation();
  const { authReady, isAuthenticated } = useAuth();

  if (!authReady) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
```

## 6. Role Route Guard

Authenticated users trying to open another role's page should be redirected safely.

```jsx
// src/auth/RoleRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RoleRoute({ allowedRoles }) {
  const { authReady, isAuthenticated, user, getHomePathForRole } = useAuth();

  if (!authReady) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getHomePathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
```

## 7. Router Example

```jsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PublicOnlyRoute } from './auth/PublicOnlyRoute';
import { RoleRoute } from './auth/RoleRoute';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={['student']} />}>
              <Route path="/student-dashboard" element={<StudentDashboard />} />
            </Route>
            <Route element={<RoleRoute allowedRoles={['faculty']} />}>
              <Route path="/faculty-dashboard" element={<FacultyDashboard />} />
            </Route>
            <Route element={<RoleRoute allowedRoles={['principal']} />}>
              <Route path="/principal-dashboard" element={<PrincipalDashboard />} />
            </Route>
            <Route element={<RoleRoute allowedRoles={['hod']} />}>
              <Route path="/hod-dashboard" element={<HodDashboard />} />
            </Route>
            <Route element={<RoleRoute allowedRoles={['cao']} />}>
              <Route path="/cao-dashboard" element={<CaoDashboard />} />
            </Route>
            <Route element={<RoleRoute allowedRoles={['security']} />}>
              <Route path="/security-dashboard" element={<SecurityDashboard />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

## 8. Login And Register Handlers

Use `navigate(..., { replace: true })` after login or registration so the browser back button does not reopen a live login/register page.

```jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

function LoginPage() {
  const navigate = useNavigate();
  const { login, getHomePathForRole } = useAuth();

  async function handleSubmit(formValues) {
    const user = await login(formValues);
    navigate(getHomePathForRole(user.role), { replace: true });
  }
}
```

```jsx
function RegisterPage() {
  const navigate = useNavigate();
  const { register, getHomePathForRole } = useAuth();

  async function handleSubmit(formValues) {
    const user = await register(formValues);
    navigate(getHomePathForRole(user.role), { replace: true });
  }
}
```

## 9. Logout Flow

The backend clears its cookie. Your frontend must also clear the token and sensitive state.

```jsx
function LogoutButton() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();

    // Also clear any dashboard store, query cache, or local sensitive state here.
    navigate('/login', { replace: true });
  }

  return <button onClick={handleLogout}>Logout</button>;
}
```

## 10. Why The Back Button Cannot Be “Disabled”

Browsers do not let us securely disable the back button. The safe approach is:

- use `replace: true` after login, register, and logout
- restore auth on refresh with `/api/auth/verify`
- block `/login` and `/register` when already authenticated
- block protected pages when unauthenticated
- redirect wrong-role users away from unauthorized dashboards

That makes back navigation harmless and correct, even though the browser history itself still exists.

## 11. Polling Hook With Latest-Response-Only Protection

This avoids the race condition where an older slow response overwrites a newer fast response.

```jsx
// src/hooks/usePollingResource.js
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePollingResource(fetcher, { intervalMs = 10000, enabled = true, deps = [] } = {}) {
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null
  });

  const run = useCallback(async () => {
    if (!enabled) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetcher({ signal: controller.signal });

      if (requestId !== requestIdRef.current) return;

      setState({
        data: response.data,
        loading: false,
        error: null,
        lastUpdated: response.meta?.lastUpdated || response.timestamp || new Date().toISOString()
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (requestId !== requestIdRef.current) return;

      setState((previous) => ({
        ...previous,
        loading: false,
        error
      }));
    }
  }, [enabled, fetcher, ...deps]);

  useEffect(() => {
    if (!enabled) return undefined;

    run();
    const timer = window.setInterval(run, intervalMs);

    return () => {
      window.clearInterval(timer);

      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [enabled, intervalMs, run]);

  return {
    ...state,
    refresh: run
  };
}
```

## 12. Dashboard Polling Example

```jsx
import { useMemo } from 'react';
import api from '../lib/apiClient';
import { useAuth } from '../auth/AuthProvider';
import { usePollingResource } from '../hooks/usePollingResource';

function getQueuePath(role) {
  switch (role) {
    case 'student':
    case 'faculty':
      return '/gatepasses/my?sortBy=updatedAt&order=desc&page=1&limit=10';
    case 'principal':
      return '/gatepasses/pending/principal?sortBy=updatedAt&order=desc&page=1&limit=10';
    case 'hod':
      return '/gatepasses/pending/hod?sortBy=updatedAt&order=desc&page=1&limit=10';
    case 'cao':
      return '/gatepasses/pending/cao?sortBy=updatedAt&order=desc&page=1&limit=10';
    case 'security':
      return '/gatepasses/pending/security?sortBy=updatedAt&order=desc&page=1&limit=10';
    default:
      return '/gatepasses/history?sortBy=updatedAt&order=desc&page=1&limit=10';
  }
}

export function DashboardContainer() {
  const { user } = useAuth();

  const summaryFetcher = useMemo(
    () => async ({ signal }) => {
      const response = await api.get('/dashboard/summary', { signal });
      return response.data;
    },
    []
  );

  const queueFetcher = useMemo(
    () => async ({ signal }) => {
      const response = await api.get(getQueuePath(user.role), { signal });
      return response.data;
    },
    [user.role]
  );

  const notificationsFetcher = useMemo(
    () => async ({ signal }) => {
      const response = await api.get('/notifications/unread-count', { signal });
      return response.data;
    },
    []
  );

  const summary = usePollingResource(summaryFetcher, { intervalMs: 10000, deps: [user.role] });
  const queue = usePollingResource(queueFetcher, { intervalMs: 10000, deps: [user.role] });
  const notifications = usePollingResource(notificationsFetcher, { intervalMs: 10000 });

  return (
    <DashboardLayout
      summary={summary.data}
      queue={queue.data}
      unreadCount={notifications.data?.unreadCount || 0}
      lastUpdated={queue.lastUpdated || summary.lastUpdated}
    />
  );
}
```

## 13. Incremental Refresh With `since`

For lighter refreshes, track the last known update timestamp:

```js
const since = lastUpdatedRef.current;
const url = since
  ? `/gatepasses/pending/principal?since=${encodeURIComponent(since)}&sortBy=updatedAt&order=desc&page=1&limit=10`
  : '/gatepasses/pending/principal?sortBy=updatedAt&order=desc&page=1&limit=10';
```

You can use `since` on:

- `/api/gatepasses/my`
- `/api/gatepasses/history`
- `/api/gatepasses/pending/principal`
- `/api/gatepasses/pending/hod`
- `/api/gatepasses/pending/cao`
- `/api/gatepasses/pending/security`
- `/api/notifications`
- `/api/dashboard/summary` as a client-tracked refresh marker

## 14. Which APIs To Call On Which Screens

Login page:

- `POST /api/auth/login`

Register page:

- `POST /api/auth/register`

App bootstrap on load:

- `GET /api/auth/verify`

Profile page:

- `GET /api/users/profile`
- `PATCH /api/users/profile`
- `POST /api/users/profile/photo`

Student and faculty dashboard:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/my?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/notifications/unread-count`

Principal dashboard:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/pending/principal?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/notifications/unread-count`

HOD dashboard:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/pending/hod?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/notifications/unread-count`

CAO dashboard:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/pending/cao?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/notifications/unread-count`

Security dashboard:

- `GET /api/dashboard/summary`
- `GET /api/gatepasses/pending/security?sortBy=updatedAt&order=desc&page=1&limit=10`
- `GET /api/gatepasses/security/verify/:token`
- `POST /api/gatepasses/:id/check-out`
- `POST /api/gatepasses/:id/check-in`
- `GET /api/notifications/unread-count`

History page:

- `GET /api/gatepasses/history?status=&page=&limit=&sortBy=updatedAt&order=desc`

Notification drawer:

- `GET /api/notifications?page=1&limit=10&sortBy=updatedAt&order=desc`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

## 15. Real-Time Upgrade Path

Your primary requirement is 10-second polling, and the backend now supports that well.

If you later want instant updates instead of polling, the best upgrade path is:

- Socket.IO or WebSockets for live gatepass queue updates
- emit events on create, forward, approve, reject, checkout, and check-in
- keep polling as a fallback when sockets disconnect

That gives you near-instant dashboards without changing the core approval APIs.
