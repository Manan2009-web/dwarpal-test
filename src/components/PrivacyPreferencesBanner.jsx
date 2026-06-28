import { useState, useEffect } from 'react'
import { Cookie, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import { ActionButton } from './ui'

const PREFERENCES_KEY = 'dwarpal-cookie-consent-preferences'

export default function PrivacyPreferencesBanner({ open, onAccept, onReject }) {
  const [showCustomize, setShowCustomize] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true,
    functional: true,
    analytics: true
  })

  // Load existing preferences if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY)
      if (stored) {
        setPreferences(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to read cookie preferences', e)
    }
  }, [])

  if (!open) {
    return null
  }

  const handleToggle = (key) => {
    if (key === 'necessary') return // Always active
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const savePreferences = (updatedPrefs) => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updatedPrefs))
    } catch (e) {
      console.error('Failed to save cookie preferences', e)
    }
  }

  const handleAcceptAll = () => {
    const allAccepted = { necessary: true, functional: true, analytics: true }
    setPreferences(allAccepted)
    savePreferences(allAccepted)
    onAccept()
  }

  const handleRejectAll = () => {
    const allRejected = { necessary: true, functional: false, analytics: false }
    setPreferences(allRejected)
    savePreferences(allRejected)
    onReject()
  }

  const handleSaveCustom = () => {
    savePreferences(preferences)
    // If they disabled functional and analytics, we treat it similarly to rejection,
    // otherwise we register general acceptance.
    if (!preferences.functional && !preferences.analytics) {
      onReject()
    } else {
      onAccept()
    }
  }

  return (
    <aside 
      className="cookie-consent-banner" 
      role="dialog" 
      aria-modal="false" 
      aria-label="Cookie preferences"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '1rem',
        padding: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="cookie-consent-copy">
          <div className="cookie-consent-icon" aria-hidden="true" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
            <Cookie size={18} />
          </div>
          <div>
            <strong style={{ fontSize: '0.95rem' }}>Cookie Preferences</strong>
            <p style={{ fontSize: '0.825rem', lineHeight: '1.4' }}>
              We use cookies to maintain your authentication session, verify your biometrics, and enhance campus navigation.
            </p>
          </div>
        </div>
        
        <div className="cookie-consent-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <ActionButton type="button" tone="secondary" onClick={() => setShowCustomize(!showCustomize)}>
            {showCustomize ? 'Hide' : 'Customize'} {showCustomize ? <ChevronUp size={14} style={{ marginLeft: '4px' }} /> : <ChevronDown size={14} style={{ marginLeft: '4px' }} />}
          </ActionButton>
          <ActionButton type="button" tone="secondary" onClick={handleRejectAll}>
            Reject Non-Essential
          </ActionButton>
          <ActionButton type="button" onClick={handleAcceptAll}>
            Accept All
          </ActionButton>
        </div>
      </div>

      {showCustomize && (
        <div 
          className="cookie-customize-panel"
          style={{
            borderTop: '1px solid var(--app-surface-border)',
            paddingTop: '1rem',
            marginTop: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          {/* Necessary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Strictly Necessary Cookies</span>
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'var(--app-surface-border)', borderRadius: '4px', color: 'var(--app-shell-muted)', fontWeight: 'bold' }}>ALWAYS ACTIVE</span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--app-shell-muted)' }}>
                Required for secure session authentication, gatepass tokens, and biometric registration flow. These cannot be disabled.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <input type="checkbox" checked={true} disabled style={{ accentColor: '#a855f7', cursor: 'not-allowed', width: '16px', height: '16px' }} />
            </div>
          </div>

          {/* Functional */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Functional Preferences</span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--app-shell-muted)' }}>
                Remembers user preferences like dismissing UI guidelines, storing theme settings, and cached dashboard views.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="checkbox" 
                checked={preferences.functional} 
                onChange={() => handleToggle('functional')} 
                style={{ accentColor: '#a855f7', cursor: 'pointer', width: '16px', height: '16px' }} 
              />
            </div>
          </div>

          {/* Analytics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Analytics & Optimization</span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--app-shell-muted)' }}>
                Anonymous data collection on application performance, response latency, and usage metrics to optimize gatepass validation speed.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="checkbox" 
                checked={preferences.analytics} 
                onChange={() => handleToggle('analytics')} 
                style={{ accentColor: '#a855f7', cursor: 'pointer', width: '16px', height: '16px' }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <ActionButton type="button" icon={ShieldCheck} onClick={handleSaveCustom}>
              Save My Preferences
            </ActionButton>
          </div>
        </div>
      )}
    </aside>
  )
}
