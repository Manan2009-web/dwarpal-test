import React from 'react'

export default class FeatureBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    const label = this.props.label || 'Optional DwarPal feature'
    console.error(`${label} failed`, error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || null
    }

    return this.props.children
  }
}
