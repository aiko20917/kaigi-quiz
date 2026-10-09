(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // v0.2 と同じ保存キーを使用。サイトのドメインが違う場合は記録も別になります。
  const storageKey = 'kaigi-quiz-v01-grades';
  const raw = window.QUESTIONS;
  const errors = [];
  if (!Array.isArray(raw)) errors.push('questions.js が読み込まれていないか、QUESTIONS が配列ではありません。');
  const ids = new Set();
  const all = (Array.isArray(raw) ? raw : []).filter((q, i) => {
    if (!q || typeof q !== 'object') { errors.push(`${i + 1}件目: 問題の形式が不正です。`); return false; }
    const required = ['id', 'subject', 'topic', 'question', 'answer'];
    const missing = required.filter(k => typeof q[k] !== 'string' || !q[k].trim());
    if (missing.length) { errors.push(`${i + 1}件目: 必須項目が不足 (${missing.join(', ')})`); return false; }
    if (ids.has(q.id)) { errors.push(`重複した問題ID: ${q.id}`); return false; }
    ids.add(q.id);
    return true;
  });
  if (!all.length) errors.push('有効な問題がありません。questions.js を確認してください。');
  $('diagnostics').textContent = errors.length
    ? `検出した問題: ${errors.join(' / ')}（有効な問題 ${all.length} 件）`
    : `正常：${all.length}問を読み込みました。IDの重複・必須項目の欠落はありません。`;

  let grades = {};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) grades = saved;
    else errors.push('保存済みの採点データの形式が不正です。');
  } catch (e) { errors.push('保存済みの採点データを読み込めませんでした。'); }
  if (errors.length) $('diagnostics').textContent += ' / ' + errors.filter(e => !$('diagnostics').textContent.includes(e)).join(' / ');

  let queue = [], position = -1;
  const current = () => queue[position];
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(grades)); return true; }
    catch (e) { alert('学習記録を保存できませんでした。ブラウザの空き容量や設定を確認してください。'); return false; }
  }
  function stats() {
    $('total').textContent = all.length;
    $('done').textContent = all.filter(q => ['○','△','×'].includes(grades[q.id])).length;
    $('weak').textContent = all.filter(q => ['△','×'].includes(grades[q.id])).length;
  }
  function topics() {
    const subject = $('subject').value, old = $('topic').value;
    const choices = [...new Set(all.filter(q => q.subject === subject).map(q => q.topic))];
    $('topic').replaceChildren(new Option('すべて', 'all'), ...choices.map(t => new Option(t, t)));
    if (choices.includes(old)) $('topic').value = old;
  }
  function show() {
    const q = current();
    $('answerBox').classList.add('hidden');
    $('response').value = '';
    $('response').disabled = !q;
    $('reveal').disabled = !q;
    $('next').disabled = !q;
    if (!q) {
      $('meta').textContent = '対象問題なし';
      $('question').textContent = 'この条件に一致する問題はありません。科目・モードを変更してください。';
      $('hint').textContent = '';
      $('answer').textContent = '';
      return;
    }
    $('meta').textContent = `${q.subject} / ${q.topic} / 問${q.number ?? '?'}　${position + 1} / ${queue.length}`;
    $('question').textContent = q.question;
    $('hint').textContent = `出題履歴：${q.history || '未登録'}　｜　資料：${q.source || '未登録'}　｜　前回：${grades[q.id] || '未採点'}`;
    $('answer').textContent = q.answer;
  }
  function start() {
    queue = all.filter(q => q.subject === $('subject').value && ($('topic').value === 'all' || q.topic === $('topic').value));
    if ($('mode').value === 'weak') queue = queue.filter(q => ['△','×'].includes(grades[q.id]));
    if ($('mode').value === 'random') {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }
    position = queue.length ? 0 : -1;
    show();
  }
  $('subject').addEventListener('change', topics);
  $('start').addEventListener('click', start);
  $('next').addEventListener('click', () => { if (!queue.length) return; position = (position + 1) % queue.length; show(); });
  $('reveal').addEventListener('click', () => { if (current()) $('answerBox').classList.remove('hidden'); });
  document.querySelectorAll('[data-grade]').forEach(b => b.addEventListener('click', () => {
    if (!current()) return;
    const id = current().id, previous = grades[id];
    grades[id] = b.dataset.grade;
    if (!save()) { if (previous === undefined) delete grades[id]; else grades[id] = previous; }
    stats();
    $('hint').textContent = `採点：${grades[id] || '未保存'}　｜　次の問題に進めます。`;
  }));
  $('reset').addEventListener('click', () => {
    if (confirm('このブラウザに保存した学習履歴をすべて削除しますか？先にバックアップをおすすめします。')) {
      const old = grades; grades = {};
      if (!save()) grades = old;
      stats(); show();
    }
  });
  $('exportGrades').addEventListener('click', () => {
    const payload = {app: 'kaigi-quiz', version: 1, exportedAt: new Date().toISOString(), grades};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'kaigi-quiz-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    $('backupStatus').textContent = 'バックアップファイルを作成しました。';
  });
  $('importGrades').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw Error('ファイルが大きすぎます（上限1MB）。');
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'kaigi-quiz' || data.version !== 1 || !data.grades || typeof data.grades !== 'object' || Array.isArray(data.grades)) throw Error('海技QUIZのバックアップ形式ではありません。');
      const entries = Object.entries(data.grades);
      if (entries.length > 100000 || entries.some(([id, grade]) => !id || !['○','△','×'].includes(grade))) throw Error('採点データの形式が不正です。');
      if (!confirm(`バックアップ内の${entries.length}件で、この端末の学習記録を上書きします。続けますか？`)) return;
      const old = grades;
      grades = Object.fromEntries(entries);
      if (!save()) { grades = old; return; }
      stats(); start();
      $('backupStatus').textContent = `復元完了：${entries.length}件を読み込みました。現在の問題に対応する記録だけが集計に表示されます。`;
    } catch (err) { $('backupStatus').textContent = `復元できませんでした：${err.message}`; }
    finally { e.target.value = ''; }
  });
  topics(); stats(); start();
})();
