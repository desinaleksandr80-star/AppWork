// Ключ, под которым записи лежат в памяти телефона (localStorage).
var STORAGE_KEY = 'entries';

var MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн',
              'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

var listEl = document.getElementById('list');
var emptyEl = document.getElementById('empty');
var addBtn = document.getElementById('add');

function loadEntries() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // Память переполнена или заблокирована — запись просто не сохранится.
  }
}

function isToday(date) {
  var now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate();
}

function formatWhen(ts) {
  var d = new Date(ts);
  var hh = String(d.getHours()).padStart(2, '0');
  var mm = String(d.getMinutes()).padStart(2, '0');
  var time = hh + ':' + mm;
  return isToday(d) ? time : d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + time;
}

function render() {
  var entries = loadEntries();

  listEl.textContent = '';
  emptyEl.hidden = entries.length > 0;

  entries.slice().sort(function (a, b) {
    return b.ts - a.ts;
  }).forEach(function (entry) {
    var card = document.createElement('li');
    card.className = 'entry';

    var amount = document.createElement('span');
    amount.className = 'entry-amount';
    amount.textContent = entry.minutes + ' мин';

    var when = document.createElement('span');
    when.className = 'entry-when';
    when.textContent = formatWhen(entry.ts);

    card.appendChild(amount);
    card.appendChild(when);
    listEl.appendChild(card);
  });
}

addBtn.addEventListener('click', function () {
  var entries = loadEntries();
  entries.push({ minutes: 30, ts: Date.now() });
  saveEntries(entries);
  render();
});

render();
