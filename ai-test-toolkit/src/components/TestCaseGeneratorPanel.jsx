import { useState, useCallback } from 'react';
import { generateTestCases, summariseByType, summariseByPriority } from '../modules/testCaseGenerator';
import { useAIModule } from '../hooks/useAIModule';

const SAMPLE_INPUT = `As a registered user, I want to log in with my email and password
so that I can access my account dashboard.

Acceptance Criteria:
- Valid credentials redirect to dashboard
- Invalid credentials show error message
- Account locks after 5 failed attempts
- Password field masks input
- "Remember me" checkbox persists session for 30 days`;

const FORMAT_OPTIONS = [
  { value: 'plain', label: 'Plain' },
  { value: 'gherkin', label: 'Gherkin / BDD' },
  { value: 'code', label: 'Code Comments' },
];

export default function TestCaseGeneratorPanel() {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState('plain');
  const { result, loading, error, execute, reset } = useAIModule(
    useCallback((inp, fmt) => generateTestCases(inp, fmt), [])
  );

  const handleSubmit = () => execute(input, format);

  const byType = result ? summariseByType(result) : {};
  const byPriority = result ? summariseByPriority(result) : {};

  return (
    <div className="panel">
      {/* Input Column */}
      <div className="panel-input-col">
        <div>
          <h2 className="panel-title">Test Case Generator</h2>
          <p className="panel-subtitle">User story → structured test cases</p>
        </div>

        <div className="card">
          <div className="card-header">Input</div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">User Story / Feature / API Spec</label>
            <textarea
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your user story, acceptance criteria, or API spec here…"
              data-testid="testgen-input"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Output Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              data-testid="testgen-format"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              data-testid="testgen-submit"
            >
              {loading ? <><span className="spinner" /> Generating…</> : '⬡ Generate Test Cases'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setInput(SAMPLE_INPUT)}
              data-testid="testgen-sample"
            >
              Load Sample
            </button>
            {result && (
              <button className="btn btn-ghost" onClick={reset}>
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-box" data-testid="testgen-error">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Output Column */}
      <div className="panel-output-col">
        {!result && !loading && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">⬡</div>
              <div className="empty-state-text">
                Paste a user story or feature description<br />
                and click Generate Test Cases
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
              <div className="empty-state-text">AI is analysing your input…</div>
            </div>
          </div>
        )}

        {result && (
          <>
            {/* Summary stats */}
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{result.testCases?.length || 0}</div>
                <div className="stat-label">Test Cases</div>
              </div>
              {Object.entries(byType).map(([type, count]) => (
                <div className="stat-card" key={type}>
                  <div className="stat-value">{count}</div>
                  <div className="stat-label">{type}</div>
                </div>
              ))}
            </div>

            <div className="card" data-testid="testgen-result">
              <div className="card-header">Results — {result.format} format</div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {result.summary}
              </p>

              {result.testCases?.map((tc) => (
                <div className="test-case-item" key={tc.id} data-testid="test-case-item">
                  <div className="test-case-header">
                    <span className="test-case-id">{tc.id}</span>
                    <span className={`badge badge-${tc.type}`}>{tc.type}</span>
                    <span className={`badge badge-${tc.priority}`}>{tc.priority}</span>
                    <span className="test-case-title">{tc.title}</span>
                  </div>

                  {tc.preconditions?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div className="result-section-title">Preconditions</div>
                      <ul className="test-case-steps">
                        {tc.preconditions.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="result-section-title">Steps</div>
                  <ul className="test-case-steps">
                    {tc.steps?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>

                  <div className="result-expected">{tc.expectedResult}</div>

                  {tc.tags?.length > 0 && (
                    <div className="tag-list">
                      {tc.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
                    </div>
                  )}
                </div>
              ))}

              {result.automationNotes && (
                <div style={{ marginTop: 12 }}>
                  <div className="result-section-title">Automation Notes</div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {result.automationNotes}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
