import { useMemo, useState } from 'react';
import {
  createQuickRecordDraft,
  emptyQuickRecordResult,
  isQuickRecordComplete,
  resultSummary,
  saveCustomerQuickRecord,
  validateQuickRecordDraft,
} from '../../services/customerQuickRecordService.js';
import CustomerQuickRecordDesktop from './CustomerQuickRecordDesktop.jsx';
import CustomerQuickRecordMobile from './CustomerQuickRecordMobile.jsx';
import './customerQuickRecord.css';

export default function CustomerQuickRecord({
  customer,
  user,
  getCurrentCustomer,
  updateCustomer,
  addEvent,
  addTask,
  onClose,
  onSaved,
}) {
  const [draft, setDraft] = useState(() => createQuickRecordDraft({ customer, user }));
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handlers = useMemo(() => ({
    onChange(section, field, value) {
      setDraft((current) => ({
        ...current,
        [section]: {
          ...current[section],
          [field]: value,
        },
      }));
      setErrors((current) => ({ ...current, [section]: '', [`${section}${capitalize(field)}`]: '' }));
    },
    onToggle(field, value) {
      setDraft((current) => {
        const next = { ...current, [field]: value };
        if (field === 'createTask' && value && !current.task.title && current.meeting.nextAction) {
          next.task = { ...current.task, title: current.meeting.nextAction };
        }
        if (field === 'createEvent' && value && !current.event.title && current.meeting.nextAction) {
          next.event = { ...current.event, title: current.meeting.nextAction };
        }
        return next;
      });
    },
  }), []);

  async function submit(event) {
    event.preventDefault();
    await save(['meeting', 'event', 'task']);
  }

  async function retry(key) {
    await save([key]);
  }

  async function save(keys) {
    const nextErrors = validateQuickRecordDraft(draft);
    const filteredErrors = filterErrorsForKeys(nextErrors, keys);
    setErrors(filteredErrors);
    if (Object.keys(filteredErrors).length > 0) return;

    setSaving(true);
    try {
      const nextResult = await saveCustomerQuickRecord({
        draft,
        result: result || emptyQuickRecordResult(),
        getCurrentCustomer,
        updateCustomer,
        addEvent,
        addTask,
        user,
        retryKeys: keys,
      });
      setResult(nextResult);

      if (isQuickRecordComplete(nextResult, draft)) {
        const summary = resultSummary(nextResult, draft);
        onSaved?.(summary);
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  }

  const commonProps = {
    customer,
    draft,
    errors,
    result,
    saving,
    onChange: handlers.onChange,
    onClose,
    onRetry: retry,
    onSave: submit,
    onToggle: handlers.onToggle,
  };

  return (
    <div className="quick-record-backdrop">
      <CustomerQuickRecordDesktop {...commonProps} />
      <CustomerQuickRecordMobile {...commonProps} />
    </div>
  );
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function filterErrorsForKeys(errors, keys) {
  const keySet = new Set(keys);
  return Object.entries(errors).reduce((next, [key, value]) => {
    if (key.startsWith('event') && !keySet.has('event')) return next;
    if (key.startsWith('task') && !keySet.has('task')) return next;
    if (key === 'meeting' && !keySet.has('meeting')) return next;
    next[key] = value;
    return next;
  }, {});
}
