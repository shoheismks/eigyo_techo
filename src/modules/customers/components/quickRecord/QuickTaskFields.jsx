export default function QuickTaskFields({ draft, errors, onChange, onToggle }) {
  return (
    <section className="quick-record-section">
      <label className="quick-record-toggle">
        <input
          type="checkbox"
          checked={draft.createTask}
          onChange={(event) => onToggle('createTask', event.target.checked)}
        />
        <span>
          <strong>タスクを作成</strong>
          <small>実行管理が必要なものだけ登録します。</small>
        </span>
      </label>
      {draft.createTask && (
        <div className="quick-record-collapsible">
          <label className="field-label">
            件名 *
            <input
              value={draft.task.title}
              onChange={(event) => onChange('task', 'title', event.target.value)}
              placeholder="例: 見積作成"
            />
            {errors.taskTitle && <small className="quick-record-error">{errors.taskTitle}</small>}
          </label>
          <div className="quick-record-two-columns">
            <label className="field-label">
              締め切り *
              <input
                type="date"
                value={draft.task.dueDate}
                onChange={(event) => onChange('task', 'dueDate', event.target.value)}
              />
              {errors.taskDueDate && <small className="quick-record-error">{errors.taskDueDate}</small>}
            </label>
            <label className="field-label">
              優先度
              <select value={draft.task.priority} onChange={(event) => onChange('task', 'priority', event.target.value)}>
                {['高', '中', '低'].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </label>
          </div>
          <label className="field-label">
            内容
            <textarea
              value={draft.task.content}
              onChange={(event) => onChange('task', 'content', event.target.value)}
              placeholder="タスクの補足"
            />
          </label>
        </div>
      )}
    </section>
  );
}
