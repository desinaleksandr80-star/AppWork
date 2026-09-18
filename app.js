/* Трекер. Всё хранится в localStorage на самом телефоне.
   Ни сети, ни аккаунтов, ни синхронизации. */

var KEY = 'tracker.v1';
var OLD_KEY = 'entries';          // формат из первой версии
var DAY = 86400000;

var MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн',
              'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

var BASELINE = 'уровень девятого класса, ниже среднего';
var SPREAD = 8;                   // разброс замера, ±%
var EDIT_WINDOW = DAY;            // запись в «Пути» правится сутки
var GONE = 14;                    // столько дней тишины — экран возвращения

/* ---- Состояние ------------------------------------------------------ */

var state = {
  entries: [],    // {minutes, ts}
  plan: null,     // {text, ts}
  baseline: null, // {text, ts} — пишется один раз и не меняется
  path: [],       // {id, before, after, ts}
  checks: [],     // {id, right, total, ts}
  now: null,      // {text, ts} — где ты сейчас, переписывается когда захочешь
  goal: null,     // {text, ts}
  step: 0,        // текущая ступень лестницы
  tasks: {}       // {'3a': {minutes, ts}} — выполненные задачи
};

var GOAL = 'Понимать, говорить и писать по-английски без переводчика';

/* Лестница: 12 ступеней по три задачи. Ступень открывается следующей
   только когда пройдены все три — календарь тут ни при чём.
   Материал всегда снаружи: приложение не обучает, оно ведёт. */
var LADDER = [
  { title: 'Опора', tasks: [
    { kind: 'слух', minutes: 45, text: 'Подкаст для уровня A2–B1, 10 минут. Прослушать без текста, потом с расшифровкой, потом снова без. Выписать 5 слов, которые мешали.' },
    { kind: 'речь', minutes: 45, text: 'Взять эти 5 слов. С каждым составить по три предложения о своём дне и произнести вслух. Записать на диктофон, переслушать один раз.' },
    { kind: 'текст', minutes: 45, text: 'Короткая статья на знакомую тему, один-два экрана. Прочитать целиком без словаря, потом второй раз со словарём.' }
  ] },
  { title: 'Дольше', tasks: [
    { kind: 'слух', minutes: 45, text: 'Тот же подкаст, 15 минут, один проход без расшифровки. Записать по-русски своими словами, о чём было.' },
    { kind: 'речь', minutes: 45, text: 'Пересказать услышанное вслух по-английски. Три минуты без остановок, как получится. Записать на диктофон и сохранить — пригодится на ступени 12.' },
    { kind: 'текст', minutes: 45, text: 'Написать 10 предложений о вчерашнем дне. Проверять переводчиком только после того, как всё написано.' }
  ] },
  { title: 'Без подпорок', tasks: [
    { kind: 'слух', minutes: 45, text: 'Видео для носителей на простую тему — кулинария, ремонт, обзор вещи. 10 минут, субтитры выключены.' },
    { kind: 'речь', minutes: 45, text: 'Описывать вслух то, что делаешь прямо сейчас. Пять минут подряд, без подготовки и без пауз на подбор слова.' },
    { kind: 'текст', minutes: 45, text: 'Статья по теме, в которой разбираешься. Выписать 10 слов, встретившихся дважды и более.' }
  ] },
  { title: 'Скорость', tasks: [
    { kind: 'слух', minutes: 50, text: 'Подкаст носителей на обычной скорости, 15 минут. Не перематывать ни разу, даже если потерял нить.' },
    { kind: 'речь', minutes: 45, text: 'Пять вопросов о себе, по минуте вслух на каждый. Потом второй круг по тем же вопросам, быстрее.' },
    { kind: 'текст', minutes: 50, text: 'Написать письмо на 150 слов. Кому угодно, хоть в стол — важен объём за один заход.' }
  ] },
  { title: 'Шум', tasks: [
    { kind: 'слух', minutes: 50, text: 'Разговор двух и более человек, 15 минут. Задача — различать, кто говорит и в чём они не согласны.' },
    { kind: 'речь', minutes: 45, text: 'Пересказать вслух сюжет любимого фильма. Пять минут, без подготовки.' },
    { kind: 'текст', minutes: 50, text: 'Три коротких текста подряд, 30 минут, словарь не открывать вообще.' }
  ] },
  { title: 'Первый рубеж', tasks: [
    { kind: 'слух', minutes: 60, text: 'Серия сериала, 20 минут, без субтитров. Потом второй раз с английскими субтитрами — посмотреть, что пропустил.' },
    { kind: 'речь', minutes: 45, text: 'Спор с самим собой: выбрать утверждение, три минуты говорить за, три минуты против.' },
    { kind: 'текст', minutes: 50, text: 'Отзыв на 200 слов о том, что посмотрел.' }
  ] },
  { title: 'Длинное', tasks: [
    { kind: 'слух', minutes: 45, text: 'Подкаст 30 минут за один заход, без пауз и перемоток.' },
    { kind: 'речь', minutes: 45, text: 'Объяснить вслух, как устроено то, в чём ты разбираешься. Семь минут, слушателя нет.' },
    { kind: 'текст', minutes: 45, text: 'Глава книги или длинная статья, 30 минут чтения без остановок.' }
  ] },
  { title: 'Живая речь', tasks: [
    { kind: 'слух', minutes: 50, text: 'Интервью или разговорное шоу, 20 минут. Выписать 10 оборотов, которых нет в учебниках.' },
    { kind: 'речь', minutes: 45, text: 'Вставить эти 10 оборотов в собственную речь. Пять минут вслух.' },
    { kind: 'текст', minutes: 50, text: 'Написать диалог на 200 слов, как сцену: двое говорят, а не пересказ.' }
  ] },
  { title: 'Без опоры', tasks: [
    { kind: 'слух', minutes: 45, text: 'Незнакомая тема, 20 минут, один раз, без перемоток. Прикинуть на глаз долю понятого.' },
    { kind: 'речь', minutes: 45, text: 'Неудобные вопросы о себе: почему уехал, чего боишься, что изменил бы. Десять минут вслух, без подготовки.' },
    { kind: 'текст', minutes: 50, text: 'Прочитать текст и письменно возразить автору. 150 слов.' }
  ] },
  { title: 'Темп носителя', tasks: [
    { kind: 'слух', minutes: 45, text: 'То же аудио на скорости 1.25, 15 минут.' },
    { kind: 'речь', minutes: 45, text: 'Прочитать вслух страницу текста, следя за интонацией, а не за скоростью. Записать и переслушать.' },
    { kind: 'текст', minutes: 50, text: 'Пересказать длинный текст письменно в 10 предложениях.' }
  ] },
  { title: 'Реальность', tasks: [
    { kind: 'слух', minutes: 60, text: 'Фильм целиком, без субтитров. Останавливаться нельзя.' },
    { kind: 'речь', minutes: 45, text: 'Разговор с живым человеком или голосовым собеседником, 15 минут.' },
    { kind: 'текст', minutes: 45, text: 'Переписка на английском в течение недели. Любая, суммарно полчаса.' }
  ] },
  { title: 'Проверка', tasks: [
    { kind: 'слух', minutes: 45, text: 'Сделать замер по процедуре с экрана «Замер» и записать результат туда.' },
    { kind: 'речь', minutes: 45, text: 'Десять минут монолога на случайную тему под запись. Потом включить запись со ступени 2 и сравнить.' },
    { kind: 'текст', minutes: 60, text: 'Написать 300 слов о том, что изменилось за 12 ступеней. Главное из написанного перенести в «Путь».' }
  ] }
];

function load() {
  var raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    raw = null;
  }

  if (raw) {
    try {
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        ['entries', 'path', 'checks'].forEach(function (k) {
          if (Array.isArray(saved[k])) state[k] = saved[k];
        });
        if (saved.plan) state.plan = saved.plan;
        if (saved.baseline) state.baseline = saved.baseline;
        if (saved.now) state.now = saved.now;
        if (saved.goal) state.goal = saved.goal;
        if (typeof saved.step === 'number') state.step = saved.step;
        if (saved.tasks && typeof saved.tasks === 'object') state.tasks = saved.tasks;
      }
    } catch (e) { /* испорченные данные — начинаем с пустого */ }
  } else {
    migrateOld();
  }

  if (!state.baseline) {
    state.baseline = { text: BASELINE, ts: Date.now() };
  }
  if (!state.goal) {
    state.goal = { text: GOAL, ts: Date.now() };
  }
  save();
}

function migrateOld() {
  try {
    var old = JSON.parse(localStorage.getItem(OLD_KEY) || '[]');
    if (Array.isArray(old) && old.length) {
      state.entries = old.filter(function (e) {
        return e && typeof e.minutes === 'number' && typeof e.ts === 'number';
      });
      save();
    }
  } catch (e) { /* нечего переносить */ }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) { /* память переполнена или заблокирована */ }
}

/* ---- Даты ----------------------------------------------------------- */

function startOfDay(ts) {
  var d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isToday(ts) {
  return startOfDay(ts) === startOfDay(Date.now());
}

function formatDate(ts) {
  var d = new Date(ts);
  var now = new Date();
  var text = d.getDate() + ' ' + MONTHS[d.getMonth()];
  if (d.getFullYear() !== now.getFullYear()) text += ' ' + d.getFullYear();
  return text;
}

function formatWhen(ts) {
  var d = new Date(ts);
  var time = String(d.getHours()).padStart(2, '0') + ':' +
             String(d.getMinutes()).padStart(2, '0');
  return isToday(ts) ? time : formatDate(ts) + ', ' + time;
}

function formatDuration(minutes) {
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  if (!h) return m + ' мин';
  if (!m) return h + ' ч';
  return h + ' ч ' + m + ' мин';
}

function plural(n, one, few, many) {
  var mod10 = n % 10;
  var mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/* ---- Подсчёты ------------------------------------------------------- */

function minutesOn(dayStart) {
  return state.entries.reduce(function (sum, e) {
    return startOfDay(e.ts) === dayStart ? sum + e.minutes : sum;
  }, 0);
}

function lastEntryTs() {
  return state.entries.reduce(function (max, e) {
    return e.ts > max ? e.ts : max;
  }, 0);
}

function activeDays(days) {
  var from = startOfDay(Date.now()) - (days - 1) * DAY;
  var seen = {};
  state.entries.forEach(function (e) {
    var d = startOfDay(e.ts);
    if (d >= from) seen[d] = true;
  });
  return Object.keys(seen).length;
}

function isGone() {
  if (!state.entries.length) return false;
  return Date.now() - lastEntryTs() > GONE * DAY;
}

function percentOf(check) {
  return Math.round((check.right / check.total) * 100);
}

/* ---- Экран «Сегодня» ------------------------------------------------ */

var planText = document.getElementById('plan-text');
var planEditor = document.getElementById('plan-editor');
var planInput = document.getElementById('plan-input');

function planIsStale() {
  return !state.plan || Date.now() - state.plan.ts > 7 * DAY;
}

function renderPlan() {
  if (planIsStale()) {
    planText.textContent = state.plan
      ? 'Неделя прошла — выбери план заново'
      : 'Выбрать план на неделю';
    planText.className = 'plan-text is-empty';
  } else {
    planText.textContent = state.plan.text;
    planText.className = 'plan-text';
  }
}

planText.addEventListener('click', function () {
  planInput.value = state.plan ? state.plan.text : '';
  planEditor.hidden = false;
  planText.hidden = true;
  planInput.focus();
});

document.getElementById('plan-cancel').addEventListener('click', function () {
  planEditor.hidden = true;
  planText.hidden = false;
});

document.getElementById('plan-save').addEventListener('click', function () {
  var text = planInput.value.trim();
  if (!text) return;
  state.plan = { text: text, ts: Date.now() };
  save();
  planEditor.hidden = true;
  planText.hidden = false;
  renderPlan();
});

var addBtn = document.getElementById('add-open');
var chips = document.getElementById('chips');

addBtn.addEventListener('click', function () {
  var opening = chips.hidden;
  chips.hidden = !opening;
  addBtn.textContent = opening ? 'Отмена' : '+';
  addBtn.className = opening ? 'add is-open' : 'add';
});

function closeChips() {
  chips.hidden = true;
  addBtn.textContent = '+';
  addBtn.className = 'add';
}

Array.prototype.forEach.call(chips.querySelectorAll('.chip'), function (chip) {
  chip.addEventListener('click', function () {
    state.entries.push({ minutes: Number(chip.dataset.minutes), ts: Date.now() });
    save();
    closeChips();
    renderToday();
  });
});

function renderBars() {
  var bars = document.getElementById('bars');
  var today = startOfDay(Date.now());
  var values = [];
  var i;

  for (i = 6; i >= 0; i--) values.push(today - i * DAY);

  var minutes = values.map(minutesOn);
  var max = Math.max.apply(null, minutes);

  bars.textContent = '';
  values.forEach(function (dayStart, index) {
    var value = minutes[index];
    var bar = document.createElement('div');
    bar.className = 'bar' +
      (value ? ' has-value' : '') +
      (dayStart === today ? ' is-today' : '');

    var fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.height = (value ? 6 + Math.round((value / max) * 60) : 6) + 'px';

    var day = document.createElement('div');
    day.className = 'bar-day';
    day.textContent = WEEKDAYS[new Date(dayStart).getDay()];

    bar.appendChild(fill);
    bar.appendChild(day);
    bars.appendChild(bar);
  });
}

function renderTotals() {
  var totals = document.getElementById('totals');
  var minutes = state.entries.reduce(function (sum, e) {
    return sum + e.minutes;
  }, 0);

  totals.textContent = '';

  var time = document.createElement('p');
  time.textContent = 'Всего ' + formatDuration(minutes);
  totals.appendChild(time);

  var steps = document.createElement('p');
  steps.textContent = state.path.length +
    ' ' + plural(state.path.length, 'запись', 'записи', 'записей') + ' в «Пути»';
  totals.appendChild(steps);
}

function renderToday() {
  var gone = isGone();

  document.getElementById('week').hidden = gone;
  document.getElementById('comeback').hidden = !gone;

  renderPlan();

  var note = document.getElementById('today-note');
  var todayMinutes = minutesOn(startOfDay(Date.now()));
  note.textContent = todayMinutes
    ? 'Сегодня ' + formatDuration(todayMinutes)
    : 'Сегодня ничего — и это нормально.';

  if (gone) {
    renderTotals();
    return;
  }

  renderBars();

  var days = activeDays(GONE);
  document.getElementById('count').textContent = days + ' из ' + GONE + ' дней';
}

/* ---- Экран «Замер» -------------------------------------------------- */

var checkRight = document.getElementById('check-right');
var checkTotal = document.getElementById('check-total');
var checkError = document.getElementById('check-error');

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

document.getElementById('check-save').addEventListener('click', function () {
  var right = Number(checkRight.value);
  var total = Number(checkTotal.value);

  checkError.hidden = true;

  if (!checkRight.value || !checkTotal.value) {
    return showError(checkError, 'Заполни оба поля.');
  }
  if (!(total > 0) || right < 0) {
    return showError(checkError, 'Числа должны быть положительными.');
  }
  if (right > total) {
    return showError(checkError, 'Верных слов не может быть больше, чем всего.');
  }

  state.checks.push({ id: Date.now(), right: right, total: total, ts: Date.now() });
  save();
  checkRight.value = '';
  checkTotal.value = '';
  renderCheck();
  renderDiff();
});

function renderCheck() {
  var list = document.getElementById('check-list');
  var due = document.getElementById('check-due');
  var sorted = state.checks.slice().sort(function (a, b) { return b.ts - a.ts; });

  list.textContent = '';
  sorted.forEach(function (check) {
    var item = document.createElement('li');
    item.className = 'entry';

    var value = document.createElement('span');
    value.className = 'entry-amount';
    value.textContent = percentOf(check) + '% ±' + SPREAD;

    var when = document.createElement('span');
    when.className = 'entry-when';
    when.textContent = formatDate(check.ts);

    item.appendChild(value);
    item.appendChild(when);
    list.appendChild(item);
  });

  document.getElementById('check-hint').hidden = !sorted.length;

  if (!sorted.length) {
    due.textContent = 'Замеров пока нет.';
    return;
  }

  var passed = Math.floor((Date.now() - sorted[0].ts) / DAY);
  var left = 30 - passed;
  due.textContent = left > 0
    ? 'Последний замер ' + formatDate(sorted[0].ts) + '. Следующий через ' +
      left + ' ' + plural(left, 'день', 'дня', 'дней') + '.'
    : 'Последний замер ' + formatDate(sorted[0].ts) + '. Можно делать новый.';
}

/* ---- Экран «Путь» --------------------------------------------------- */

var pathEditor = document.getElementById('path-editor');
var pathBefore = document.getElementById('path-before');
var pathAfter = document.getElementById('path-after');
var pathError = document.getElementById('path-error');
var pathOpen = document.getElementById('path-open');
var editingId = null;

function openPathEditor(entry) {
  editingId = entry ? entry.id : null;
  pathBefore.value = entry ? entry.before : '';
  pathAfter.value = entry ? entry.after : '';
  pathError.hidden = true;
  pathEditor.hidden = false;
  pathOpen.hidden = true;
  pathBefore.focus();
}

function closePathEditor() {
  editingId = null;
  pathEditor.hidden = true;
  pathOpen.hidden = false;
}

var nowText = document.getElementById('now-text');
var nowEditor = document.getElementById('now-editor');
var nowInput = document.getElementById('now-input');

nowText.addEventListener('click', function () {
  nowInput.value = state.now ? state.now.text : '';
  nowEditor.hidden = false;
  nowText.hidden = true;
  nowInput.focus();
});

document.getElementById('now-cancel').addEventListener('click', function () {
  nowEditor.hidden = true;
  nowText.hidden = false;
});

document.getElementById('now-save').addEventListener('click', function () {
  var text = nowInput.value.trim();
  if (!text) return;
  state.now = { text: text, ts: Date.now() };
  save();
  nowEditor.hidden = true;
  nowText.hidden = false;
  renderPath();
  renderDiff();
});

pathOpen.addEventListener('click', function () { openPathEditor(null); });
document.getElementById('path-cancel').addEventListener('click', closePathEditor);

document.getElementById('path-save').addEventListener('click', function () {
  var before = pathBefore.value.trim();
  var after = pathAfter.value.trim();

  pathError.hidden = true;
  if (!before || !after) {
    return showError(pathError, 'Нужны обе части: раньше и теперь.');
  }

  if (editingId) {
    state.path.forEach(function (entry) {
      if (entry.id === editingId && Date.now() - entry.ts <= EDIT_WINDOW) {
        entry.before = before;
        entry.after = after;
      }
    });
  } else {
    state.path.push({ id: Date.now(), before: before, after: after, ts: Date.now() });
  }

  save();
  closePathEditor();
  renderPath();
  renderDiff();
  renderToday();
});

function renderPath() {
  var list = document.getElementById('path-list');
  document.getElementById('baseline-text').textContent = state.baseline.text;

  nowText.textContent = state.now ? state.now.text : 'Ещё не описано';
  nowText.className = state.now ? 'plan-text' : 'plan-text is-empty';

  list.textContent = '';
  state.path.slice().sort(function (a, b) { return b.ts - a.ts; })
    .forEach(function (entry) {
      var item = document.createElement('li');
      item.className = 'step';

      var beforeLabel = document.createElement('p');
      beforeLabel.className = 'label';
      beforeLabel.textContent = 'Раньше';

      var before = document.createElement('p');
      before.className = 'step-before';
      before.textContent = entry.before;

      var afterLabel = document.createElement('p');
      afterLabel.className = 'label';
      afterLabel.textContent = 'Теперь';

      var after = document.createElement('p');
      after.className = 'step-after';
      after.textContent = entry.after;

      var foot = document.createElement('div');
      foot.className = 'step-foot';

      var when = document.createElement('span');
      when.className = 'step-when';
      when.textContent = formatDate(entry.ts);
      foot.appendChild(when);

      if (Date.now() - entry.ts <= EDIT_WINDOW) {
        var edit = document.createElement('button');
        edit.className = 'step-edit';
        edit.type = 'button';
        edit.textContent = 'Изменить';
        edit.addEventListener('click', function () { openPathEditor(entry); });
        foot.appendChild(edit);
      }

      item.appendChild(beforeLabel);
      item.appendChild(before);
      item.appendChild(afterLabel);
      item.appendChild(after);
      item.appendChild(foot);
      list.appendChild(item);
    });
}

/* ---- Экран «Разница» ------------------------------------------------ */

function diffCard(label, from, to, number, numberClass) {
  var card = document.createElement('section');
  card.className = 'diff';

  var title = document.createElement('p');
  title.className = 'label';
  title.textContent = label;
  card.appendChild(title);

  var fromEl = document.createElement('p');
  fromEl.className = 'diff-from';
  fromEl.textContent = from;
  card.appendChild(fromEl);

  var arrow = document.createElement('p');
  arrow.className = 'diff-arrow';
  arrow.textContent = '↓';
  card.appendChild(arrow);

  var toEl = document.createElement('p');
  toEl.className = 'diff-to';
  toEl.textContent = to;
  card.appendChild(toEl);

  if (number) {
    var numberEl = document.createElement('p');
    numberEl.className = numberClass || 'diff-number';
    numberEl.textContent = number;
    card.appendChild(numberEl);
  }

  return card;
}

function quietNote(text) {
  var note = document.createElement('p');
  note.className = 'lead';
  note.textContent = text;
  return note;
}

function renderDiff() {
  var body = document.getElementById('diff-body');
  body.textContent = '';

  if (state.now) {
    body.appendChild(diffCard('Состояние',
      state.baseline.text, state.now.text,
      'Описано ' + formatDate(state.now.ts), 'diff-when'));
  } else {
    body.appendChild(quietNote(
      'Точка отсчёта: ' + state.baseline.text +
      '. Сравнивать пока не с чем — опиши на экране «Путь», где ты сейчас.'));
  }

  var checks = state.checks.slice().sort(function (a, b) { return a.ts - b.ts; });
  if (checks.length >= 2) {
    var first = percentOf(checks[0]);
    var last = percentOf(checks[checks.length - 1]);
    var delta = last - first;
    body.appendChild(diffCard('Замер',
      first + '% ±' + SPREAD + ', ' + formatDate(checks[0].ts),
      last + '% ±' + SPREAD + ', ' + formatDate(checks[checks.length - 1].ts),
      (delta > 0 ? '+' : '') + delta + '% — при разбросе ±' + SPREAD));
  } else if (checks.length === 1) {
    body.appendChild(quietNote('Один замер: ' + percentOf(checks[0]) + '% ±' +
      SPREAD + '. Разница появится после второго.'));
  } else {
    body.appendChild(quietNote('Замеров пока нет.'));
  }
}

/* ---- Экран «Цель» --------------------------------------------------- */

var goalText = document.getElementById('goal-text');
var goalEditor = document.getElementById('goal-editor');
var goalInput = document.getElementById('goal-input');

goalText.addEventListener('click', function () {
  goalInput.value = state.goal.text;
  goalEditor.hidden = false;
  goalText.hidden = true;
  goalInput.focus();
});

document.getElementById('goal-cancel').addEventListener('click', function () {
  goalEditor.hidden = true;
  goalText.hidden = false;
});

document.getElementById('goal-save').addEventListener('click', function () {
  var text = goalInput.value.trim();
  if (!text) return;
  state.goal = { text: text, ts: Date.now() };
  save();
  goalEditor.hidden = true;
  goalText.hidden = false;
  renderGoal();
});

document.getElementById('step-next').addEventListener('click', function () {
  if (state.step < LADDER.length - 1) {
    state.step += 1;
    save();
    renderGoal();
    window.scrollTo(0, 0);
  }
});

function taskId(stepIndex, taskIndex) {
  return (stepIndex + 1) + 'abc'.charAt(taskIndex);
}

function completeTask(id, minutes) {
  state.tasks[id] = { minutes: minutes, ts: Date.now() };
  state.entries.push({ minutes: minutes, ts: Date.now() });
  save();
  renderGoal();
  renderToday();
}

function buildTask(stepIndex, taskIndex, task) {
  var id = taskId(stepIndex, taskIndex);
  var done = state.tasks[id];

  var card = document.createElement('section');
  card.className = 'task' + (done ? ' is-done' : '');

  var kind = document.createElement('p');
  kind.className = 'task-kind';
  kind.textContent = task.kind;
  card.appendChild(kind);

  var text = document.createElement('p');
  text.className = 'task-text';
  text.textContent = task.text;
  card.appendChild(text);

  if (done) {
    var mark = document.createElement('p');
    mark.className = 'task-done';
    mark.textContent = 'Сделано ' + formatDate(done.ts) + ' — ' +
      formatDuration(done.minutes);
    card.appendChild(mark);
    return card;
  }

  var time = document.createElement('p');
  time.className = 'task-time';
  time.textContent = 'примерно ' + task.minutes + ' мин';
  card.appendChild(time);

  var chips = document.createElement('div');
  chips.className = 'chips';
  chips.hidden = true;

  var button = document.createElement('button');
  button.className = 'task-do';
  button.type = 'button';
  button.textContent = 'Сделал';
  button.addEventListener('click', function () {
    var opening = chips.hidden;
    chips.hidden = !opening;
    button.textContent = opening ? 'Отмена' : 'Сделал';
    button.className = opening ? 'task-do is-open' : 'task-do';
  });

  [15, 30, 45, 60].forEach(function (minutes) {
    var chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = minutes + ' мин';
    chip.addEventListener('click', function () {
      completeTask(id, minutes);
    });
    chips.appendChild(chip);
  });

  card.appendChild(button);
  card.appendChild(chips);
  return card;
}

function renderGoal() {
  goalText.textContent = state.goal.text;

  var stepIndex = state.step;
  var step = LADDER[stepIndex];
  var tasks = document.getElementById('tasks');
  var over = document.getElementById('step-over');

  document.getElementById('step-label').textContent =
    'Ступень ' + (stepIndex + 1) + ' из ' + LADDER.length;
  document.getElementById('step-title').textContent = step.title;

  tasks.textContent = '';
  step.tasks.forEach(function (task, index) {
    tasks.appendChild(buildTask(stepIndex, index, task));
  });

  var left = step.tasks.filter(function (task, index) {
    return !state.tasks[taskId(stepIndex, index)];
  }).length;

  if (left) {
    over.hidden = true;
    return;
  }

  over.hidden = false;
  var last = stepIndex === LADDER.length - 1;
  document.getElementById('step-over-text').textContent = last
    ? 'Лестница пройдена целиком. Дальше цель ставится заново — напиши мне, и я соберу следующую.'
    : 'Ступень пройдена. Следующая — «' + LADDER[stepIndex + 1].title + '».';
  document.getElementById('step-next').hidden = last;
}

/* ---- Вкладки -------------------------------------------------------- */

var tabs = document.querySelectorAll('.tab');

Array.prototype.forEach.call(tabs, function (tab) {
  tab.addEventListener('click', function () {
    Array.prototype.forEach.call(tabs, function (other) {
      other.className = other === tab ? 'tab is-active' : 'tab';
    });
    ['today', 'goal', 'check', 'path', 'diff'].forEach(function (name) {
      document.getElementById('screen-' + name).hidden = name !== tab.dataset.screen;
    });
    window.scrollTo(0, 0);
  });
});

/* ---- Старт ---------------------------------------------------------- */

load();
renderToday();
renderGoal();
renderCheck();
renderPath();
renderDiff();
