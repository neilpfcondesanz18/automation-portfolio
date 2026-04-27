import { useState } from 'react';
import TestCaseGeneratorPanel from './components/TestCaseGeneratorPanel';
import BugReportAnalyserPanel from './components/BugReportAnalyserPanel';
import CIFailureDecoderPanel from './components/CIFailureDecoderPanel';
import './App.css';

const TABS = [
  {
    id: 'testgen',
    label: 'Test Case Generator',
    icon: '⬡',
    description: 'User story → structured test cases',
  },
  {
    id: 'bugreport',
    label: 'Bug Report Analyser',
    icon: '◈',
    description: 'Stack trace → triage + runbook',
  },
  {
    id: 'cifailure',
    label: 'CI Failure Decoder',
    icon: '⬢',
    description: 'CI log → root cause + fix',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('testgen');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark">◆</span>
            <div>
              <h1 className="brand-name">QA Intelligence</h1>
              <p className="brand-sub">AI-Powered Test Automation Toolkit</p>
            </div>
          </div>
          <div className="header-badge">SENIOR ENGINEER EDITION</div>
        </div>

        <nav className="tab-nav" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              <span className="tab-desc">{tab.description}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          className="panel-container"
        >
          {activeTab === 'testgen' && <TestCaseGeneratorPanel />}
          {activeTab === 'bugreport' && <BugReportAnalyserPanel />}
          {activeTab === 'cifailure' && <CIFailureDecoderPanel />}
        </div>
      </main>

      <footer className="app-footer">
        <span>QA Intelligence Toolkit · Built for automation engineers</span>
        <span className="footer-model">Powered by Claude Sonnet</span>
      </footer>
    </div>
  );
}
