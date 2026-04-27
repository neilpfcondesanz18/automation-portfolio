import { useState, useCallback } from 'react';
import { analyseBugReport, requiresEscalation } from '../modules/bugReportAnalyser';
import { useAIModule } from '../hooks/useAIModule';

const SAMPLE_BUG = `Title: NullPointerException on checkout when cart has expired items

Environment: Production (us-east-1), Node 18.x, Express 4.18
Reported by: 47 users in last 2 hours

Stack Trace:
TypeError: Cannot read properties of null (reading 'price')
    at CartService.calculateTotal (/app/services/cart.js:142:28)
    at CheckoutController.initiate (/app/controllers/checkout.js:67:34)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)

Steps to Reproduce:
1. Add items to cart
2. Leave cart idle for 25+ minutes
3. Attempt checkout

Expected: Show "item no longer available" message
Actual: 500 Internal Server Error`;

export default function BugReportAnalyserPanel() {
  const [input, setInput] = useState('');
  const { result, loading, error, execute, reset } = useAIModule(
    useCallback((inp) => analyseBugReport(inp), [])
  );

  const handleSubmit = () => execute(input);
  const escalate = result ? requiresEscalation(result) : false;

  return (
    <div className="panel">
      {/* Input Column */}
      <div className="panel-input-col">
        <div>
          <h2 className="panel-title">Bug Report Analyser</h2>
          <p className="panel-subtitle">Stack trace → triage + runbook</p>
        </div>

        <div className="card">
          <div className="card-header">Input</div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Bug Report / Error Log / Stack Trace</label>
            <textarea
              rows={12}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your bug report, stack trace, or error log here…"
              data-testid="bugreport-input"
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              data-testid="bugreport-submit"
            >
              {loading ? <><span className="spinner" /> Analysing…</> : '◈ Analyse Report'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setInput(SAMPLE_BUG)}
              data-testid="bugreport-sample"
            >
              Load Sample
            </button>
            {result && (
              <button className="btn btn-ghost" onClick={reset}>Clear</button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-box" data-testid="bugreport-error">⚠ {error}</div>
        )}
      </div>

      {/* Output Column */}
      <div className="panel-output-col">
        {!result && !loading && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">◈</div>
              <div className="empty-state-text">
                Paste a bug report or stack trace<br />
                and click Analyse Report
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="card">
            <div className="empty-state">
              <div style={{ marginBottom: 12 }}>
                <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              </div>
              <div className="empty-state-text">AI is triaging the report…</div>
            </div>
          </div>
        )}

        {result && (
          <>
            {escalate && (
              <div
                style={{
                  background: 'var(--red-dim)',
                  border: '1px solid var(--red)',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  color: 'var(--red)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                data-testid="escalation-alert"
              >
                ⚠ CRITICAL — Requires immediate escalation
              </div>
            )}

            <div className="card" data-testid="bugreport-result">
              <div className="card-header">Triage Summary</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span
                  className={`badge badge-${result.severity}`}
                  data-testid="severity-badge"
                >
                  {result.severity}
                </span>
                <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent-bright)', border: '1px solid var(--accent)' }}>
                  {result.category}
                </span>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16, fontWeight: 500 }}>
                {result.summary}
              </p>

              <div className="info-row">
                <span className="info-key">Root Cause Confidence</span>
                <span className="info-val">{result.rootCause?.confidence}</span>
              </div>
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {result.rootCause?.explanation}
              </div>

              {result.rootCause?.affectedComponents?.length > 0 && (
                <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="result-section-title">Affected Components</div>
                  <div className="tag-list">
                    {result.rootCause.affectedComponents.map((c) => (
                      <span key={c} className="tag">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">Immediate Actions</div>
              <ul className="bullet-list">
                {result.immediateActions?.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>

            <div className="card">
              <div className="card-header">Remediation Runbook</div>
              {result.runbook?.map((step) => (
                <div className="runbook-step" key={step.step} data-testid="runbook-step">
                  <div className="runbook-step-num">
                    {String(step.step).padStart(2, '0')}
                  </div>
                  <div className="runbook-step-body">
                    <div className="runbook-step-action">{step.action}</div>
                    {step.command && (
                      <div className="runbook-step-command">$ {step.command}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      ✓ {step.expectedOutcome}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {result.automationOpportunity && (
              <div className="card">
                <div className="card-header">Automation Opportunity</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {result.automationOpportunity}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
