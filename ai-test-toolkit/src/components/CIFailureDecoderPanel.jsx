import { useState, useCallback } from 'react';
import { decodeCIFailure, topErrorSignals, isHighPriority, formatFixTime } from '../modules/ciFailureDecoder';
import { useAIModule } from '../hooks/useAIModule';

const SAMPLE_LOG = `Run npm test

FAIL src/__tests__/auth.test.js
  ● AuthService › login › should return token for valid credentials

    expect(received).resolves.toEqual(expected)

    - Expected  - 1
    + Received  + 1

    Object {
    -   "token": "eyJhb...",
    +   "token": undefined,
    }

      47 |   it('should return token for valid credentials', async () => {
      48 |     const result = await AuthService.login('user@test.com', 'valid-pass');
    > 49 |     expect(result).resolves.toEqual({ token: expect.any(String) });

Test Suites: 1 failed, 4 passed, 5 total
Tests:       3 failed, 42 passed, 45 total
Snapshots:   0 total
Time:        14.236s

Error: Process completed with exit code 1.`;

const FAILURE_TYPE_COLOURS = {
  test_failure: 'var(--yellow)',
  build_error: 'var(--red)',
  lint_error: 'var(--orange)',
  timeout: 'var(--orange)',
  dependency: 'var(--yellow)',
  auth: 'var(--red)',
  network: 'var(--orange)',
  config: 'var(--red)',
  unknown: 'var(--text-muted)',
};

export default function CIFailureDecoderPanel() {
  const [input, setInput] = useState('');
  const { result, loading, error, execute, reset } = useAIModule(
    useCallback((inp) => decodeCIFailure(inp), [])
  );

  const handleSubmit = () => execute(input);
  const highPriority = result ? isHighPriority(result) : false;
  const signals = result ? topErrorSignals(result, 3) : [];

  return (
    <div className="panel">
      {/* Input Column */}
      <div className="panel-input-col">
        <div>
          <h2 className="panel-title">CI Failure Decoder</h2>
          <p className="panel-subtitle">CI log → root cause + fix</p>
        </div>

        <div className="card">
          <div className="card-header">Input</div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">GitHub Actions / CI Log Output</label>
            <textarea
              rows={12}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your CI/CD failure log here…"
              data-testid="cifailure-input"
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              data-testid="cifailure-submit"
            >
              {loading ? <><span className="spinner" /> Decoding…</> : '⬢ Decode Failure'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setInput(SAMPLE_LOG)}
              data-testid="cifailure-sample"
            >
              Load Sample
            </button>
            {result && (
              <button className="btn btn-ghost" onClick={reset}>Clear</button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-box" data-testid="cifailure-error">⚠ {error}</div>
        )}
      </div>

      {/* Output Column */}
      <div className="panel-output-col">
        {!result && !loading && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">⬢</div>
              <div className="empty-state-text">
                Paste a CI/CD failure log<br />
                and click Decode Failure
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
              <div className="empty-state-text">AI is diagnosing the failure…</div>
            </div>
          </div>
        )}

        {result && (
          <>
            {highPriority && (
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
                }}
                data-testid="high-priority-alert"
              >
                ⬢ High priority — pipeline blocker detected
              </div>
            )}

            <div className="card" data-testid="cifailure-result">
              <div className="card-header">Failure Diagnosis</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  className="badge"
                  style={{
                    background: `${FAILURE_TYPE_COLOURS[result.failureType] || 'var(--text-muted)'}20`,
                    color: FAILURE_TYPE_COLOURS[result.failureType] || 'var(--text-muted)',
                    border: `1px solid ${FAILURE_TYPE_COLOURS[result.failureType] || 'var(--text-muted)'}`,
                  }}
                  data-testid="failure-type-badge"
                >
                  {result.failureType?.replace(/_/g, ' ')}
                </span>
                {result.isFlaky && (
                  <span className="badge badge-medium">⚡ potentially flaky</span>
                )}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  Est. fix: {formatFixTime(result)}
                </span>
              </div>

              <div className="info-row">
                <span className="info-key">Failing Step</span>
                <span className="info-val" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {result.failingStep}
                </span>
              </div>

              <p style={{ padding: '12px 0', fontSize: 14, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                {result.plainEnglishSummary}
              </p>

              <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div className="result-section-title">Root Cause</div>
                {result.rootCause}
              </div>

              {result.flakinessReason && (
                <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--yellow)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)' }}>
                  ⚡ {result.flakinessReason}
                </div>
              )}
            </div>

            {signals.length > 0 && (
              <div className="card">
                <div className="card-header">Key Error Signals</div>
                {signals.map((s, i) => (
                  <div key={i} className="code-block" style={{ marginBottom: 6, maxHeight: 80 }}>
                    {s}
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <div className="card-header">
                Fix — confidence: {result.fix?.confidence}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {result.fix?.description}
              </p>

              {result.fix?.codeChanges?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="result-section-title">Changes Needed</div>
                  <ul className="bullet-list">
                    {result.fix.codeChanges.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {result.fix?.commands?.length > 0 && (
                <div>
                  <div className="result-section-title">Commands</div>
                  {result.fix.commands.map((cmd, i) => (
                    <div key={i} className="runbook-step-command" style={{ display: 'block', marginBottom: 4 }}>
                      $ {cmd}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.preventionTips?.length > 0 && (
              <div className="card">
                <div className="card-header">Prevention Tips</div>
                <ul className="bullet-list">
                  {result.preventionTips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
