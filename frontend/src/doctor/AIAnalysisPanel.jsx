import { useState } from 'react'
import { Sparkles, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import { generateReport } from '../shared/api'

export default function AIAnalysisPanel({ patientId, analysisData, onAnalysisGenerated }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await generateReport(patientId)
    setLoading(false)
    if (data?.analysis) {
      onAnalysisGenerated(data.analysis)
    } else {
      setError(err || 'Failed to generate analysis')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-600" />
          <h3 className="font-bold text-gray-800">AI Clinical Analysis</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating...' : 'Generate Analysis'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
          {error}
        </div>
      )}

      {!analysisData && !loading && !error && (
        <div className="text-center py-8 text-gray-400">
          <Sparkles className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Click &ldquo;Generate Analysis&rdquo; to create a weekly clinical analysis</p>
        </div>
      )}

      {analysisData && (
        <div className="space-y-4">
          {/* Summary */}
          {analysisData.summary && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-gray-700 mb-2">Weekly Summary</h4>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{analysisData.summary}</p>
            </div>
          )}

          {/* Key Findings */}
          {analysisData.key_findings?.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-gray-700 mb-2">Key Findings</h4>
              <div className="space-y-2">
                {analysisData.key_findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {f.severity === 'critical' || f.severity === 'high'
                      ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      : <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    }
                    <div>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        f.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        f.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        f.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{f.severity || 'info'}</span>
                      <p className="text-sm text-gray-600 mt-1">{f.text || f.finding || (typeof f === 'string' ? f : JSON.stringify(f))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {analysisData.recommended_actions?.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-gray-700 mb-2">Recommended Actions</h4>
              <ol className="list-decimal list-inside space-y-1.5">
                {analysisData.recommended_actions.map((a, i) => (
                  <li key={i} className="text-sm text-gray-600">
                    {a.text || a.action || (typeof a === 'string' ? a : JSON.stringify(a))}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Risk Level */}
          {analysisData.risk_level && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Overall Risk:</span>
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                analysisData.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                analysisData.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {analysisData.risk_level.toUpperCase()}
              </span>
            </div>
          )}

          {/* Raw text fallback */}
          {typeof analysisData === 'string' && (
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{analysisData}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
