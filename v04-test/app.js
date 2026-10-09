(() => {
'use strict';
const $ = id => document.getElementById(id);
const gradeKey = 'kaigi-quiz-v01-grades';
const historyKey = 'kaigi-quiz-v04-history';
const questionKey = 'kaigi-quiz-v04-custom-questions';
const validGrades = ['○','△','×'];
const issues = [];
function read(key, fallback) { try { const raw=localStorage.getItem(key); return raw===null ? fallback : JSON.parse(raw); } catch(e) { issues.push(`${key}: 保存データを読み込めません。`); return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch(e) { alert('保存できませんでした。空き容量やブラウザ設定を確認してください。'); return false; } }
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const base = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
if (!Array.isArray(window.QUESTIONS)) issues.push('questions.js が読み込めないか、問題データが配列ではありません。');
let custom = read(questionKey, []);
if (!Array.isArray(custom)) { issues.push('追加問題の保存形式が不正です。'); custom=[]; }
let all = [];
function validate(list) {
  const seen = new Set(), errors = [], valid = [];
  list.forEach((q, i) => {
    if (!isObject(q)) { errors.push(`${i+1}件目: 問題形式が不正`); return; }
    const missing=['id','subject','topic','question','answer'].filter(k => typeof q[k] !== 'string' || !q[k].trim());
    if (missing.length) { errors.push(`${i+1}件目: 必須項目不足 (${missing.join(', ')})`); return; }
    if (seen.has(q.id)) { errors.push(`重複した問題ID: ${q.id}`); return; }
    seen.add(q.id); valid.push(q);
  });
  return {valid, errors};
}
function refreshData() {
  const result=validate([...base,...custom]); all=result.valid;
  const notes=[...issues,...result.errors];
  if (!all.length) notes.push('有効な問題がありません。');
  $('diagnostics').textContent = notes.length ? `検出した問題: ${notes.join(' / ')}（有効な問題 ${all.length} 件）` : `正常：${all.length}問を読み込みました。IDの重複・必須項目の欠落はありません。`;
}
let grades=read(gradeKey, {});
if (!isObject(grades)) { issues.push('旧版の採点記録の形式が不正です。'); grades={}; }
let history=read(historyKey, {});
if (!isObject(history)) { issues.push('学習履歴の形式が不正です。'); history={}; }
let queue=[],position=-1;
const current=()=>queue[position];
function stats(){ $('total').textContent=all.length; $('done').textContent=all.filter(q=>validGrades.includes(grades[q.id])).length; $('weak').textContent=all.filter(q=>['△','×'].includes(grades[q.id])).length; }
function topics(){const subject=$('subject').value, old=$('topic').value; const choices=[...new Set(all.filter(q=>q.subject===subject).map(q=>q.topic))]; $('topic').replaceChildren(new Option('すべて','all'),...choices.map(t=>new Option(t,t))); if(choices.includes(old)) $('topic').value=old;}
function show(){ const q=current(); $('answerBox').classList.add('hidden'); $('response').value=''; $('response').disabled=!q; $('reveal').disabled=!q; $('next').disabled=!q;
 if(!q){$('meta').textContent='対象問題なし';$('question').textContent='この条件に一致する問題はありません。科目・モードを変更してください。';$('hint').textContent='';$('questionHistory').textContent='';$('answer').textContent='';return;}
 $('meta').textContent=`${q.subject} / ${q.topic} / 問${q.number ?? '?'}　${position+1} / ${queue.length}`; $('question').textContent=q.question;
 $('hint').textContent=`出題履歴：${q.history||'未登録'}　｜　資料：${q.source||'未登録'}　｜　前回：${grades[q.id]||'未採点'}`;
 const h=history[q.id]; $('questionHistory').textContent=h&&Array.isArray(h.attempts) ? `学習履歴：${h.attempts.length}回採点 / 最終 ${new Date(h.attempts[h.attempts.length-1].at).toLocaleString('ja-JP')}` : validGrades.includes(grades[q.id]) ? '学習履歴：旧版の採点記録あり（日時不明）' : '学習履歴：まだ採点していません';
 $('answer').textContent=q.answer;
}
function start(){queue=all.filter(q=>q.subject===$('subject').value&&($('topic').value==='all'||q.topic===$('topic').value)); if($('mode').value==='weak')queue=queue.filter(q=>['△','×'].includes(grades[q.id])); if($('mode').value==='random')for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]];}position=queue.length?0:-1;show();}
$('subject').addEventListener('change',()=>{topics();start();}); $('start').addEventListener('click',start);
$('next').addEventListener('click',()=>{if(queue.length){position=(position+1)%queue.length;show();}});
$('reveal').addEventListener('click',()=>{if(current())$('answerBox').classList.remove('hidden');});
document.querySelectorAll('[data-grade]').forEach(b=>b.addEventListener('click',()=>{const q=current();if(!q)return; const id=q.id, grade=b.dataset.grade; if(!validGrades.includes(grade))return;
 const nextGrades={...grades,[id]:grade}; const prev=history[id]&&Array.isArray(history[id].attempts)?history[id].attempts:[];
 const nextHistory={...history,[id]:{attempts:[...prev,{grade,at:new Date().toISOString()}].slice(-500)}};
 if(!store(gradeKey,nextGrades))return;
 if(!store(historyKey,nextHistory)){store(gradeKey,grades);return;}
 grades=nextGrades;history=nextHistory;stats();show();$('answerBox').classList.remove('hidden');$('hint').textContent=`採点を保存：${grade}`;
}));
$('reset').addEventListener('click',()=>{if(!confirm('この端末の採点と学習履歴をすべて削除しますか？先にバックアップを保存してください。'))return;
 if(!store(gradeKey,{})||!store(historyKey,{}))return;grades={};history={};stats();start();});
function download(data,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
$('exportGrades').addEventListener('click',()=>{download({app:'kaigi-quiz',version:2,exportedAt:new Date().toISOString(),grades,history},'kaigi-quiz-v04-backup.json');$('backupStatus').textContent='バックアップを作成しました（採点＋学習履歴）。';});
$('importGrades').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;
 try{if(file.size>5*1024*1024)throw Error('ファイルが大きすぎます（上限5MB）。');const data=JSON.parse(await file.text());
 if(!isObject(data)||data.app!=='kaigi-quiz'||![1,2].includes(data.version)||!isObject(data.grades))throw Error('対応していないバックアップ形式です。');
 const entries=Object.entries(data.grades);if(entries.length>100000||entries.some(([id,g])=>!id||!validGrades.includes(g)))throw Error('採点データが不正です。');
 const newHistory=data.version===2?data.history:{};if(!isObject(newHistory))throw Error('学習履歴の形式が不正です。');
 if(Object.entries(newHistory).some(([id,h])=>!id||!isObject(h)||!Array.isArray(h.attempts)||h.attempts.length>500||h.attempts.some(a=>!isObject(a)||!validGrades.includes(a.grade)||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at)))))throw Error('学習履歴の内容が不正です。');
 if(!confirm(`${entries.length}件の採点記録で、この端末の記録を上書きします。続けますか？`))return;
 if(!store(gradeKey,data.grades)||!store(historyKey,newHistory))return;grades=data.grades;history=newHistory;stats();start();$('backupStatus').textContent=`復元完了：${entries.length}件（バックアップ形式 v${data.version}）`;
 }catch(err){$('backupStatus').textContent=`復元できませんでした：${err.message}`;}finally{e.target.value='';}
});
$('importQuestions').addEventListener('click',()=>$('questionFile').click());
$('questionFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;
 try{if(file.size>2*1024*1024)throw Error('ファイルが大きすぎます（上限2MB）。');const data=JSON.parse(await file.text());const incoming=Array.isArray(data)?data:(isObject(data)&&Array.isArray(data.questions)?data.questions:null);
 if(!incoming||!incoming.length||incoming.length>5000)throw Error('問題の配列がありません（1～5000問）。');
 const checked=validate([...base,...custom,...incoming]);if(checked.errors.length)throw Error(checked.errors.slice(0,5).join(' / '));
 if(!confirm(`${incoming.length}問をこの端末に追加します。よろしいですか？`))return;
 const next=[...custom,...incoming];if(!store(questionKey,next))return;custom=next;refreshData();topics();stats();start();$('questionStatus').textContent=`${incoming.length}問を追加しました（合計 ${all.length} 問）。`;
 }catch(err){$('questionStatus').textContent=`読み込み失敗：${err.message}`;}finally{e.target.value='';}
});
$('exportQuestions').addEventListener('click',()=>{download({app:'kaigi-quiz',questions:custom},'kaigi-quiz-added-questions.json');$('questionStatus').textContent=`追加問題 ${custom.length} 問をダウンロードしました。`;});
$('clearQuestions').addEventListener('click',()=>{if(!confirm(`この端末に追加した ${custom.length} 問を削除しますか？採点履歴は残ります。`))return;if(!store(questionKey,[]))return;custom=[];refreshData();topics();stats();start();$('questionStatus').textContent='追加問題を削除しました。';});
refreshData();topics();stats();start();
})();
