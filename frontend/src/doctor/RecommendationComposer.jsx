import { useState, useEffect } from 'react'
import { Send, Eye, Trash2, Loader2 } from 'lucide-react'
import { draftRecommendation, approveRecommendation } from '../shared/api'
import DashboardPreview from './DashboardPreview'

export default function RecommendationComposer({ patientId, patientName, draftText = '' }) {
  const [text, setText] = useState(draftText)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [recId, setRecId] = useState(null)

  const MAX_CHARS = 500

  // Update draft text when AI analysis generates a recommendation
  useEffect(() => {
    if (draftText && !text) setText(draftText)
  }, [draftText])

  async function handleSend() {
    if (!text.trim()) return
    setLoading(true)

    // Draft first, then approve
    const draft = await draftRecommendation(patientId, { content: text, recommendation_type: 'general' })
    if (draft.data?.recommendation_id) {
      const id = draft.data.recommendation_id
      setRecId(id)
      await approveRecommendation(patientId, id, text)
      setSent(true)
    } else if (draft.error) {
      alert(draft.error)
    }

    setLoading(false)
  }

  if (sent) {
    return (
      <div className="bg-green-50 rounded-xl border border-green-200 p-5 text-center">
        <p className="text-green-700 font-medium">Recommendation sent to {patientName} successfully!</p>
        <button onClick={() => { setSent(false); setText('') }} className="mt-2 text-sm text-green-600 hover:underline">
          Send another
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <h3 className="font-bold text-gray-800 mb-3">Send Recommendation to Patient</h3>

      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
        placeholder={`Write a personalised recommendation for ${patientName}...`}
        className="w-full border rounded-lg px-4 py-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
      />
      <div className="flex justify-between items-center mt-1 mb-3">
        <span className={`text-xs ${text.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
          {text.length}/{MAX_CHARS}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setShowPreview(true)}
          disabled={!text.trim()}
          className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
        >
          <Eye className="w-4 h-4" /> Preview
        </button>
        <button
          onClick={handleSend}
          disabled={!text.trim() || loading}
          className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? 'Sending...' : 'Send to Patient'}
        </button>
        {text && (
          <button
            onClick={() => setText('')}
            className="flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-red-500 rounded-lg text-sm transition"
          >
            <Trash2 className="w-4 h-4" /> Discard
          </button>
        )}
      </div>

      {showPreview && (
        <DashboardPreview
          patientId={patientId}
          pendingRecommendation={text}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
