(function () {
  const KEY = "nurse-roster-v1";
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const TABS = [
    { id: "근무표", tone: "roster" },
    { id: "인원", tone: "staff" },
    { id: "오프", tone: "off" },
    { id: "설정", tone: "settings" },
    { id: "공유", tone: "share" }
  ];
  const HOLIDAYS = {
    "2025-01-01": "신정", "2025-01-27": "임시공휴일", "2025-01-28": "설날", "2025-01-29": "설날", "2025-01-30": "설날",
    "2025-03-01": "삼일절", "2025-03-03": "대체공휴일", "2025-05-05": "어린이날·부처님오신날", "2025-05-06": "대체공휴일",
    "2025-06-03": "선거일", "2025-06-06": "현충일", "2025-08-15": "광복절", "2025-10-03": "개천절",
    "2025-10-05": "추석", "2025-10-06": "추석", "2025-10-07": "추석", "2025-10-08": "대체공휴일", "2025-10-09": "한글날",
    "2025-12-25": "기독탄신일",
    "2026-01-01": "신정", "2026-02-16": "설날", "2026-02-17": "설날", "2026-02-18": "설날",
    "2026-03-01": "삼일절", "2026-03-02": "대체공휴일", "2026-05-01": "노동절", "2026-05-05": "어린이날",
    "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일", "2026-06-03": "지방선거", "2026-06-06": "현충일",
    "2026-07-17": "제헌절", "2026-08-15": "광복절", "2026-08-17": "대체공휴일", "2026-09-24": "추석",
    "2026-09-25": "추석", "2026-09-26": "추석", "2026-10-03": "개천절", "2026-10-05": "대체공휴일",
    "2026-10-09": "한글날", "2026-12-25": "기독탄신일",
    "2027-01-01": "신정", "2027-02-06": "설날", "2027-02-07": "설날", "2027-02-08": "설날", "2027-02-09": "대체공휴일",
    "2027-03-01": "삼일절", "2027-05-01": "노동절", "2027-05-03": "대체공휴일", "2027-05-05": "어린이날",
    "2027-05-13": "부처님오신날", "2027-06-06": "현충일", "2027-07-17": "제헌절", "2027-07-19": "대체공휴일",
    "2027-08-15": "광복절", "2027-08-16": "대체공휴일", "2027-09-14": "추석", "2027-09-15": "추석", "2027-09-16": "추석",
    "2027-10-03": "개천절", "2027-10-04": "대체공휴일", "2027-10-09": "한글날", "2027-10-11": "대체공휴일",
    "2027-12-25": "기독탄신일", "2027-12-27": "대체공휴일",
    "2028-01-01": "신정", "2028-01-26": "설날", "2028-01-27": "설날", "2028-01-28": "설날", "2028-03-01": "삼일절",
    "2028-04-12": "국회의원선거", "2028-05-01": "노동절", "2028-05-02": "부처님오신날", "2028-05-05": "어린이날",
    "2028-06-06": "현충일", "2028-07-17": "제헌절", "2028-08-15": "광복절", "2028-10-02": "추석",
    "2028-10-03": "개천절·추석", "2028-10-04": "추석", "2028-10-05": "대체공휴일", "2028-10-09": "한글날",
    "2028-12-25": "기독탄신일"
  };

  const root = document.getElementById("app");
  let app = load();
  const ui = { tab: "근무표", flash: "", busy: false, focusId: "", showAll: false, editGrid: false, query: "", showEveryRow: false, moreWarn: false, showFair: false, shareQuery: "", linkFallback: "", offDraft: "", offDateDraft: "", editingYearsId: "" };
  let reportStamp = "";
  let reportCache = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function uid() { return "s" + Math.random().toString(36).slice(2, 8); }
  function monthKey(year, month) { return year + "-" + String(month).padStart(2, "0"); }
  function isoOf(year, month, day) { return monthKey(year, month) + "-" + String(day).padStart(2, "0"); }
  function todayIso() {
    const now = new Date();
    return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }
  function mark(shift, requested) {
    if (requested) return "신청";
    if (shift === "D") return "D";
    if (shift === "E") return "E";
    if (shift === "N") return "N";
    return "오프";
  }
  function shiftName(code) {
    if (code === "D") return "데이";
    if (code === "E") return "이브닝";
    if (code === "N") return "나이트";
    return "오프";
  }
  function defaultApp() {
    const now = new Date();
    return {
      version: 1,
      wardName: "",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      shifts: {
        D: { name: "데이", start: "07:00", end: "15:00" },
        E: { name: "이브닝", start: "15:00", end: "23:00" },
        N: { name: "나이트", start: "22:30", end: "07:30" }
      },
      extraHolidays: [],
      removedHolidays: [],
      weekdayTarget: "",
      weekendTarget: "",
      staff: [],
      offPeople: [],
      requests: {},
      schedules: {}
    };
  }
  function roleKind(role) {
    if (role === "선임" || role === "신규") return role;
    return "년차";
  }
  function roleYears(role) {
    const match = String(role || "").match(/^(\d+)년차$/);
    return match ? match[1] : "1";
  }
  function roleFromParts(kind, years) {
    if (kind === "선임" || kind === "신규") return kind;
    const num = Math.max(1, Math.min(40, Number(years) || 1));
    return num + "년차";
  }
  function normalizeOffPeople() {
    if (!Array.isArray(app.offPeople)) app.offPeople = [];
    app.offPeople = app.offPeople.map(function (item) {
      if (typeof item === "string") return { name: item, date: "" };
      return { name: String((item && item.name) || "").trim(), date: String((item && item.date) || "").trim() };
    }).filter(function (item) { return item.name; });
  }
  function hasOffPeople() {
    normalizeOffPeople();
    return app.offPeople.some(function (item) { return item.name && item.date; });
  }
  function findStaffByName(name) {
    const target = String(name || "").trim();
    return app.staff.find(function (person) { return person.name.trim() === target; });
  }
  function lockOffRequest(name, date) {
    const person = findStaffByName(name);
    if (!person || !date) return false;
    const dates = requestsFor(person.id);
    if (dates.indexOf(date) < 0) {
      dates.push(date);
      setRequests(person.id, dates.sort());
    }
    return true;
  }
  function unlockOffRequest(name, date) {
    const person = findStaffByName(name);
    if (!person || !date) return;
    const dates = requestsFor(person.id).filter(function (iso) { return iso !== date; });
    setRequests(person.id, dates);
  }
  function applyAllOffPeople() {
    normalizeOffPeople();
    app.offPeople.forEach(function (item) {
      if (item.name && item.date) lockOffRequest(item.name, item.date);
    });
  }
  function defaultOffDate() {
    if (ui.offDateDraft) return ui.offDateDraft;
    const today = todayIso();
    if (today.indexOf(currentKey()) === 0) return today;
    return isoOf(app.year, app.month, 1);
  }
  function formatOffDate(iso) {
    if (!iso || iso.length < 10) return iso || "";
    return Number(iso.slice(5, 7)) + "/" + Number(iso.slice(8, 10));
  }
  function renderOffPeopleCard() {
    normalizeOffPeople();
    const chips = app.offPeople.map(function (item, index) {
      const label = item.date ? esc(item.name) + " · " + esc(formatOffDate(item.date)) : esc(item.name);
      return '<span class="off-chip">' + label + '<button type="button" data-act="remove-off-person" data-index="' + index + '" aria-label="삭제">×</button></span>';
    }).join("");
    return '<section class="card"><h2>오프인원</h2>' +
      '<div class="row off-people-row">' +
      '<input id="off-person-name" type="text" maxlength="20" placeholder="이름" value="' + esc(ui.offDraft) + '">' +
      '<input id="off-person-date" type="date" value="' + esc(defaultOffDate()) + '">' +
      '<button class="btn" type="button" data-act="add-off-person">확인</button></div>' +
      '<div class="off-people-list">' + (chips || '<span class="muted-inline">이름과 날짜를 넣고 확인을 누르세요</span>') + "</div></section>";
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.version === 1 && Array.isArray(saved.staff)) return Object.assign(defaultApp(), saved);
    } catch (err) { /* 저장된 값이 깨진 경우 새로 시작합니다. */ }
    return defaultApp();
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(app));
    reportStamp = "";
  }
  function holidayMap(year) {
    const map = {};
    Object.keys(HOLIDAYS).forEach(function (iso) {
      if (iso.indexOf(String(year) + "-") === 0 && app.removedHolidays.indexOf(iso) === -1) map[iso] = HOLIDAYS[iso];
    });
    app.extraHolidays.forEach(function (item) {
      if (item.date && item.date.indexOf(String(year) + "-") === 0) map[item.date] = item.name || "휴무";
    });
    return map;
  }
  function buildDays(year, month) {
    const map = holidayMap(year);
    const count = new Date(year, month, 0).getDate();
    const days = [];
    for (let day = 1; day <= count; day++) {
      const iso = isoOf(year, month, day);
      const dow = new Date(year, month - 1, day).getDay();
      const holiday = map[iso] || "";
      days.push({ day: day, iso: iso, dow: dow, holiday: holiday, weekend: dow === 0 || dow === 6 || !!holiday });
    }
    return days;
  }
  function currentKey() { return monthKey(app.year, app.month); }
  function requestsFor(id) {
    const bag = app.requests[currentKey()] || {};
    return bag[id] ? bag[id].slice() : [];
  }
  function setRequests(id, dates) {
    if (!app.requests[currentKey()]) app.requests[currentKey()] = {};
    app.requests[currentKey()][id] = dates;
  }
  function carryChain() {
    const chain = [];
    let year = app.year;
    let month = app.month;
    for (let i = 0; i < 12; i++) {
      if (month === 1) { year -= 1; month = 12; } else month -= 1;
      const key = monthKey(year, month);
      if (!app.schedules[key]) break;
      chain.unshift({ grid: app.schedules[key], weekendLike: buildDays(year, month).map(function (day) { return day.weekend; }) });
    }
    return chain;
  }
  function pastStats(personId) {
    const stats = { weekendOffs: 0, weekdayOffs: 0, nights: 0, weekendWorks: 0, weekdayWorks: 0 };
    const end = app.year * 12 + app.month - 1;
    for (let back = 1; back <= 11; back++) {
      const index = end - back;
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      const grid = app.schedules[monthKey(year, month)] && app.schedules[monthKey(year, month)][personId];
      if (!grid) continue;
      const days = buildDays(year, month);
      grid.forEach(function (shift, i) {
        const weekend = !!(days[i] && days[i].weekend);
        if (shift === "OFF") { if (weekend) stats.weekendOffs += 1; else stats.weekdayOffs += 1; }
        else if (weekend) { stats.weekendWorks += 1; if (shift === "N") stats.nights += 1; }
        else { stats.weekdayWorks += 1; if (shift === "N") stats.nights += 1; }
      });
    }
    return stats;
  }
  function schedulerInput(days) {
    const requests = {};
    const carry = {};
    const history = {};
    const chain = carryChain();
    app.staff.forEach(function (person) {
      requests[person.id] = requestsFor(person.id).map(function (iso) {
        return days.findIndex(function (day) { return day.iso === iso; });
      }).filter(function (index) { return index >= 0; });
      carry[person.id] = window.RosterScheduler.carryState(chain, person.id);
      history[person.id] = pastStats(person.id);
    });
    return {
      staff: app.staff.map(function (person) { return { id: person.id, name: person.name.trim(), role: person.role }; }),
      weekendLike: days.map(function (day) { return day.weekend; }),
      requests: requests,
      carry: carry,
      history: history,
      weekdayTarget: Number(app.weekdayTarget) || 0,
      weekendTarget: Number(app.weekendTarget) || 0
    };
  }
  function currentReport() {
    const key = currentKey();
    if (!app.schedules[key]) return null;
    const stamp = JSON.stringify([app.schedules[key], app.requests[key], app.staff, app.year, app.month, app.extraHolidays, app.removedHolidays, app.weekdayTarget, app.weekendTarget]);
    if (stamp === reportStamp) return reportCache;
    const days = buildDays(app.year, app.month);
    const full = {};
    app.staff.forEach(function (person) {
      const row = app.schedules[key][person.id];
      full[person.id] = row && row.length === days.length ? row.slice() : new Array(days.length).fill("OFF");
    });
    reportCache = window.RosterScheduler.validateGrid(schedulerInput(days), full);
    reportStamp = stamp;
    return reportCache;
  }
  function weekendCount() {
    return buildDays(app.year, app.month).filter(function (day) { return day.weekend; }).length;
  }
  function roleRequestGap(iso) {
    const notes = [];
    ["선임", "5년차"].forEach(function (role) {
      const people = app.staff.filter(function (person) { return person.role === role; });
      if (!people.length) return;
      const offCount = people.filter(function (person) { return requestsFor(person.id).indexOf(iso) >= 0; }).length;
      if (offCount === people.length) notes.push(role + "이 모두 이 날 오프입니다.");
    });
    return notes;
  }

  function legend() {
    const shifts = app.shifts;
    return '<div class="legend">' +
      '<span class="badge D">데이 ' + esc(shifts.D.start) + "–" + esc(shifts.D.end) + "</span>" +
      '<span class="badge E">이브닝 ' + esc(shifts.E.start) + "–" + esc(shifts.E.end) + "</span>" +
      '<span class="badge N">나이트 ' + esc(shifts.N.start) + "–" + esc(shifts.N.end) + "</span>" +
      '<span class="badge OFF">오프</span><span class="badge REQ">신청 오프</span></div>';
  }
  function calendarHtml(days, renderDay, extraClass) {
    const today = todayIso();
    let html = DOW.map(function (name, index) {
      return '<div class="dow ' + (index === 0 ? "sun" : index === 6 ? "sat" : "") + '">' + name + "</div>";
    }).join("");
    for (let i = 0; i < days[0].dow; i++) html += '<div class="day out"></div>';
    days.forEach(function (day) { html += renderDay(day, day.iso === today); });
    return '<div class="cal' + (extraClass ? " " + extraClass : "") + '">' + html + "</div>";
  }
  function namesForDay(staff, gridById, requestsById, day, index, nameAct) {
    const buckets = { D: [], E: [], N: [], OFF: [] };
    staff.forEach(function (person) {
      const row = (gridById && gridById[person.id]) || [];
      const shift = row[index] || "OFF";
      const code = shift === "D" || shift === "E" || shift === "N" ? shift : "OFF";
      const requested = ((requestsById && requestsById[person.id]) || []).indexOf(day.iso) >= 0 && code === "OFF";
      const act = ' data-id="' + person.id + '"' + (nameAct ? ' data-act="' + nameAct + '"' : "");
      buckets[code].push('<button type="button" class="who ' + (requested ? "REQ" : code) + '"' + act + ">" + esc(person.name) + "</button>");
    });
    return ["D", "E", "N", "OFF"].map(function (code) {
      if (!buckets[code].length) return "";
      return '<div class="who-block"><span class="badge ' + code + '">' + (code === "OFF" ? "오프" : code) + "</span>" + buckets[code].join("") + "</div>";
    }).join("");
  }

  function renderSettings() {
    return '<section class="card"><h2>병동 이름</h2><div class="field"><input id="ward" type="text" maxlength="30" value="' + esc(app.wardName) + '" placeholder="예: 5병동"></div></section>' +
      '<section class="card"><h2>근무 시간</h2>' +
      ["D", "E", "N"].map(function (code) {
        const shift = app.shifts[code];
        return '<div class="row" style="margin-bottom:8px"><strong class="shift-label ' + code + '">' + shiftName(code) + "</strong>" +
          '<input data-shift="' + code + '" data-part="start" type="time" value="' + esc(shift.start) + '">' +
          '<input data-shift="' + code + '" data-part="end" type="time" value="' + esc(shift.end) + '"></div>';
      }).join("") + "</section>";
  }

  function renderStaff() {
    return '<section class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">근무자 ' + app.staff.length + '명</h2><button class="btn" type="button" data-act="add-staff">추가</button></div>' +
      app.staff.map(function (person, index) {
        const kind = roleKind(person.role);
        const years = roleYears(person.role);
        const yearDisplay = kind === "년차" && years ? years + "년차" : "";
        return '<div class="staff-item"><label class="field who"><span>이름</span><input data-staff="' + person.id + '" data-prop="name" type="text" maxlength="20" value="' + esc(person.name) + '"></label>' +
          '<label class="field"><span>직책</span><select data-role-kind="' + person.id + '">' +
          ["선임", "신규", "년차"].map(function (option) {
            const label = option === "년차" ? (yearDisplay || "?년차") : option;
            return '<option value="' + option + '"' + (kind === option ? " selected" : "") + ">" + esc(label) + "</option>";
          }).join("") +
          '</select></label>' +
          (kind === "년차" && ui.editingYearsId === person.id
            ? '<div class="year-role-edit"><input data-role-years="' + person.id + '" type="number" min="1" max="40" placeholder="?" value="' + (years || "") + '"><span>년차</span></div>'
            : "") +
          '<button class="btn-tiny" type="button" data-act="up" data-id="' + person.id + '"' + (index === 0 ? " disabled" : "") + ">위로</button>" +
          '<button class="btn-tiny" type="button" data-act="down" data-id="' + person.id + '"' + (index === app.staff.length - 1 ? " disabled" : "") + ">아래로</button>" +
          '<button class="btn-tiny danger" type="button" data-act="del-staff" data-id="' + person.id + '">삭제</button></div>';
      }).join("") +
      "</section>";
  }

  function renderOff(days) {
    if (!app.staff.length) return '<section class="card"><h2>오프 신청</h2><p class="help">먼저 인원 탭에서 근무자를 추가해 주세요.</p></section>';
    const selected = app.staff.some(function (person) { return person.id === ui.focusId; }) ? ui.focusId : app.staff[0].id;
    const person = app.staff.find(function (item) { return item.id === selected; });
    const mine = requestsFor(selected);
    return '<section class="card"><h2>오프 신청 · ' + esc(person.name) + "</h2>" +
      '<div class="chips">' + app.staff.map(function (item) {
        return '<button class="chip' + (item.id === selected ? " on" : "") + '" type="button" data-act="pick" data-id="' + item.id + '">' + esc(item.name) + "</button>";
      }).join("") + "</div>" +
      calendarHtml(days, function (day, isToday) {
        const on = mine.indexOf(day.iso) >= 0;
        const cls = ["day", "readable", day.dow === 0 ? "sun" : "", day.dow === 6 ? "sat" : "", day.holiday ? "holi" : "", on ? "on" : "", isToday ? "today" : ""].join(" ");
        return '<button class="' + cls + '" type="button" data-act="toggle-off" data-id="' + selected + '" data-iso="' + day.iso + '"><span class="n">' + day.day + "</span>" +
          (on ? '<span class="badge REQ">신청</span>' : "") + "</button>";
      }) +
      "</section>";
  }

  function personSummary(person, report, days) {
    if (!report || !report.stats) return "";
    const stat = report.stats.people.find(function (item) { return item.id === person.id; });
    if (!stat) return "";
    let reqWeekend = 0;
    let reqWeekday = 0;
    requestsFor(person.id).forEach(function (iso) {
      const day = days.find(function (item) { return item.iso === iso; });
      if (!day) return;
      if (day.weekend) reqWeekend += 1; else reqWeekday += 1;
    });
    return stat.nights + "나이트 · 오프 " + (stat.weekendOff + stat.weekdayOff + reqWeekend + reqWeekday) + "일 (주말·공휴일 " +
      (stat.weekendOff + reqWeekend) + " · 평일 " + (stat.weekdayOff + reqWeekday) + ")";
  }

  function renderRoster(days) {
    const key = currentKey();
    let body = renderOffPeopleCard();
    if (!app.schedules[key]) {
      return body + '<section class="card"><h2>근무표</h2><button class="btn wide" type="button" data-act="generate">' + (ui.busy ? "만드는 중" : "근무표 만들기") + "</button></section>";
    }
    const focus = app.staff.some(function (person) { return person.id === ui.focusId; }) ? ui.focusId : app.staff[0].id;
    const person = app.staff.find(function (item) { return item.id === focus; });
    body += '<section class="card roster-card"><div class="person-head"><h2 style="margin:0">' + (ui.showAll ? "전체 달력" : "개인 달력") + '</h2>' +
      '<div class="row"><button class="btn-tiny" type="button" data-act="toggle-all">' + (ui.showAll ? "개인 달력" : "전체 표") + '</button>' +
      '<button class="btn-tiny" type="button" data-act="generate"' + (ui.busy ? " disabled" : "") + ">" + (ui.busy ? "만드는 중" : "다시 만들기") + "</button></div></div>" +
      '<div class="chips">' + app.staff.map(function (item) {
        return '<button class="chip' + (!ui.showAll && item.id === focus ? " on" : "") + '" type="button" data-act="focus" data-id="' + item.id + '">' + esc(item.name) + "</button>";
      }).join("") + "</div>";
    if (!ui.showAll && person) {
      const row = app.schedules[key][person.id] || [];
      body += '<div class="person-head"><div><strong>' + esc(person.name) + '</strong> <span class="role-tag">' + esc(person.role) + "</span></div></div>";
      body += calendarHtml(days, function (day, isToday) {
        const shift = row[day.day - 1] || "OFF";
        const requested = requestsFor(person.id).indexOf(day.iso) >= 0 && shift === "OFF";
        const cls = ["day", "readable", day.dow === 0 ? "sun" : "", day.dow === 6 ? "sat" : "", day.holiday ? "holi" : "", isToday ? "today" : ""].join(" ");
        return '<div class="' + cls + '"><span class="n">' + day.day + '</span><span class="badge big ' + (requested ? "REQ" : shift) + '">' + mark(shift, requested) + "</span></div>";
      });
    }
    if (ui.showAll) {
      body += '<div class="cal-scroll">' + calendarHtml(days, function (day, isToday) {
        const cls = ["day", "all", "readable", day.dow === 0 ? "sun" : "", day.dow === 6 ? "sat" : "", day.holiday ? "holi" : "", isToday ? "today" : ""].join(" ");
        return '<div class="' + cls + '"><div class="day-top"><span class="n">' + day.day + "</span></div>" +
          namesForDay(app.staff, app.schedules[key], app.requests[key] || {}, day, day.day - 1, "focus") + "</div>";
      }, "all") + "</div>";
      body += '<button class="btn-tiny" type="button" data-act="edit-grid" style="margin-top:8px">' + (ui.editGrid ? "수정 표 접기" : "근무 칸 수정") + "</button>";
      let rows = app.staff.filter(function (item) {
        return !ui.query || item.name.indexOf(ui.query) >= 0 || item.role.indexOf(ui.query) >= 0;
      });
      const trimmed = rows.length > 20 && !ui.showEveryRow && !ui.query;
      if (trimmed) rows = rows.slice(0, 20);
      if (ui.editGrid) {
      body += '<div class="row" style="margin-top:8px"><input id="find" type="search" placeholder="이름 검색" value="' + esc(ui.query) + '"></div>';
      body += '<div class="table-scroll"><table><thead><tr><th>이름</th>' + days.map(function (day) {
        const cls = day.iso === todayIso() ? "todayh" : day.dow === 0 || day.holiday ? "sunh" : day.dow === 6 ? "sath" : "";
        return '<th class="' + cls + '">' + day.day + "</th>";
      }).join("") + "</tr></thead><tbody>";
      rows.forEach(function (item) {
        const row = app.schedules[key][item.id] || [];
        body += "<tr><td>" + esc(item.name) + "<br><span class=\"role-tag\">" + esc(item.role) + "</span></td>";
        days.forEach(function (day, index) {
          const shift = row[index] || "OFF";
          const requested = requestsFor(item.id).indexOf(day.iso) >= 0 && shift === "OFF";
          const cls = requested ? "REQ" : shift;
          const text = requested ? "신" : shift === "OFF" ? "오" : shift;
          body += '<td class="' + cls + '"><button type="button" data-act="cycle" data-id="' + item.id + '" data-day="' + index + '">' + text + "</button></td>";
        });
        body += "</tr>";
      });
      body += "</tbody></table></div>";
      if (trimmed) body += '<button class="btn-ghost" type="button" data-act="every-row" style="margin-top:8px">전체 ' + app.staff.length + "명 펼치기</button>";
      }
    }
    body += "</section>" + renderFair();
    return body;
  }

  function renderFair() {
    const end = app.year * 12 + app.month - 1;
    const months = [];
    for (let back = 0; back < 12; back++) {
      const index = end - back;
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      const key = monthKey(year, month);
      if (app.schedules[key]) months.push({ year: year, month: month, key: key });
    }
    if (!months.length) return "";
    const lines = app.staff.map(function (person) {
      const stat = { weekendOffs: 0, weekdayOffs: 0, nights: 0 };
      months.forEach(function (item) {
        const grid = app.schedules[item.key][person.id];
        if (!grid) return;
        const days = buildDays(item.year, item.month);
        grid.forEach(function (shift, index) {
          const weekend = days[index] && days[index].weekend;
          if (shift === "OFF") { if (weekend) stat.weekendOffs += 1; else stat.weekdayOffs += 1; }
          else if (shift === "N") stat.nights += 1;
        });
      });
      return "<tr><td>" + esc(person.name) + "</td><td>" + stat.weekendOffs + "</td><td>" + stat.weekdayOffs + "</td><td>" + stat.nights + "</td></tr>";
    }).join("");
    if (!ui.showFair) {
      return '<section class="card"><button class="btn-ghost wide" type="button" data-act="toggle-fair">상세보기</button></section>';
    }
    return '<section class="card"><div class="person-head"><h2 style="margin:0">최근 ' + months.length + '개월 분포</h2>' +
      '<button class="btn-tiny" type="button" data-act="toggle-fair">접기</button></div>' +
      '<div class="table-scroll" style="margin-top:10px"><table class="fair"><thead><tr><th>이름</th><th>주말 오프</th><th>평일 오프</th><th>나이트</th></tr></thead><tbody>' + lines + "</tbody></table></div></section>";
  }

  function renderShare() {
    if (!app.schedules[currentKey()]) return '<section class="card"><h2>공유</h2><p class="help">근무표를 만든 뒤에 보낼 수 있습니다.</p></section>';
    const people = app.staff.filter(function (person) {
      return !ui.shareQuery || person.name.indexOf(ui.shareQuery) >= 0;
    });
    return '<section class="card"><h2>근무자에게 보내기</h2>' +
      '<div class="row"><button class="btn" type="button" data-act="download-all">전체 보기 파일</button><button class="btn-ghost" type="button" data-act="copy-all">전체 링크 복사</button></div>' +
      (ui.linkFallback ? '<textarea readonly style="width:100%;min-height:88px;margin-top:8px">' + esc(ui.linkFallback) + "</textarea>" : "") +
      '<div class="field" style="margin-top:12px"><span>사람 찾기</span><input id="sharefind" type="search" value="' + esc(ui.shareQuery) + '" placeholder="이름"></div>' +
      people.map(function (person) {
        return '<div class="share-item"><div style="flex:1"><b>' + esc(person.name) + '</b><div class="sub">' + esc(person.role) + '</div></div>' +
          '<button class="btn-tiny" type="button" data-act="download-one" data-id="' + person.id + '">파일</button>' +
          '<button class="btn-tiny" type="button" data-act="copy-one" data-id="' + person.id + '">링크</button></div>';
      }).join("") +
      '<div class="row" style="margin-top:12px"><button class="btn-ghost" type="button" data-act="backup">백업 저장</button><button class="btn-ghost" type="button" data-act="pick-restore">백업 불러오기</button><input id="restore" class="hidden-file" type="file" accept="application/json,.json"></div></section>';
  }

  function renderEditor() {
    const days = buildDays(app.year, app.month);
    const now = new Date();
    document.title = (app.wardName || "간호사 근무표") + " " + app.year + "년 " + app.month + "월";
    root.innerHTML = '<main class="wrap tab-' + esc(ui.tab) + '"><header class="top"><div><p class="eyebrow">오늘 ' + (now.getMonth() + 1) + "월 " + now.getDate() + '일</p><h1>' + esc(app.wardName || "간호사 근무표") + '</h1><p class="sub">' + app.year + "년 " + app.month + '월</p></div>' +
      '<div class="month-switch"><button class="btn-tiny" type="button" data-act="prev-month">이전달</button><strong>' + app.month + '월</strong><button class="btn-tiny" type="button" data-act="next-month">다음달</button></div></header>' +
      (ui.flash ? '<div class="note">' + esc(ui.flash) + "</div>" : "") +
      (ui.tab === "설정" ? renderSettings() : "") +
      (ui.tab === "인원" ? renderStaff() : "") +
      (ui.tab === "오프" ? renderOff(days) : "") +
      (ui.tab === "근무표" ? renderRoster(days) : "") +
      (ui.tab === "공유" ? renderShare() : "") +
      '</main><nav class="nav">' + TABS.map(function (tab) {
        return '<button type="button" class="nav-' + tab.tone + (ui.tab === tab.id ? " on" : "") + '" data-act="tab" data-tab="' + tab.id + '">' + tab.id + "</button>";
      }).join("") + "</nav>";
  }

  function viewPayload(focus) {
    const days = buildDays(app.year, app.month);
    return {
      ward: app.wardName || "근무표",
      year: app.year,
      month: app.month,
      shifts: app.shifts,
      staff: app.staff.map(function (person) { return { id: person.id, name: person.name, role: person.role }; }),
      days: days.map(function (day) { return { n: day.day, dow: day.dow, weekend: day.weekend, holiday: day.holiday, iso: day.iso }; }),
      grid: app.schedules[currentKey()] || {},
      requests: app.requests[currentKey()] || {},
      focus: focus || ""
    };
  }

  async function packPayload(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === "undefined") return "r." + bytesToB64(bytes);
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return "z." + bytesToB64(out);
  }
  async function unpackPayload(raw) {
    const kind = raw.slice(0, 2);
    const bytes = b64ToBytes(raw.slice(2));
    if (kind === "r.") return JSON.parse(new TextDecoder().decode(bytes));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(out));
  }
  function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function b64ToBytes(text) {
    const pad = (4 - (text.length % 4)) % 4;
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "====".slice(0, pad));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function safeName(value) { return String(value || "근무표").replace(/[\\/:*?"<>|]/g, "").slice(0, 40); }
  function shareDocument(payload) {
    const data = JSON.stringify(payload).replace(/</g, "\\u003c");
    return "<!DOCTYPE html><html lang=\"ko\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>" +
      esc(payload.ward) + " " + payload.month + "월</title><style>" +
      "body{margin:0;font-family:Segoe UI,Malgun Gothic,sans-serif;background:#f3efe6;color:#1c2430}main{width:min(1100px,100%);margin:0 auto;padding:16px}h1{font-size:24px;margin:0}.sub{color:#5f675c}button,.day{font:inherit}.chips{display:flex;gap:8px;overflow:auto;padding:8px 0}.chip{border:1px solid #e6dfd2;background:#fffdf8;border-radius:999px;padding:8px 12px;font-weight:700}.chip.on{background:#0e6b66;color:#fff;border-color:#0e6b66}.cal-scroll{overflow-x:auto}.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.cal.all{grid-template-columns:repeat(7,minmax(0,1fr));min-width:0}.dow{text-align:center;font-size:12px;font-weight:700;color:#5f675c}.sun{color:#c44747}.sat{color:#2a62b0}.day{min-height:72px;border:1px solid #e6dfd2;border-radius:12px;background:#fffdf8;display:flex;flex-direction:column;align-items:center;padding:6px 2px;gap:4px}.day.all{align-items:stretch;text-align:left;padding:6px}.day b,.n{font-size:13px;font-weight:800}.badge,.who{border-radius:999px;padding:2px 6px;font-size:11px;font-weight:800}.who{display:block;text-align:left;border:0;margin-top:2px;border-radius:7px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:720px){main{padding:8px}.cal,.cal.all{gap:3px}.day.all{padding:3px 1px;border-radius:8px}.who{font-size:10px;padding:1px}.badge{font-size:9px;padding:1px 2px}}.D{background:#fff1cc;color:#8a5a00}.E{background:#ffe6d8;color:#a84812}.N{background:#e5ecf8;color:#243e78}.OFF{background:#e5f2ea;color:#246348}.REQ{background:#fde8e4;color:#9d342c}.legend{display:flex;gap:6px;flex-wrap:wrap}.card{background:#fffdf8;border-radius:18px;padding:14px;margin-top:12px}" +
      "</style></head><body><main id=\"view\"></main><script type=\"application/json\" id=\"roster\">" + data + "</script><script>" +
      "function esc(s){return String(s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}" +
      "const P=JSON.parse(document.getElementById('roster').textContent);const DOW=['일','월','화','수','목','금','토'];let focus=P.focus?P.focus:'';" +
      "function name(c){return c==='D'?'D':c==='E'?'E':c==='N'?'N':'오프'}" +
      "function draw(){const shifts=P.shifts;const now=new Date();const today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');" +
      "const chips='<button class=\"chip '+(!focus?'on':'')+'\" data-id=\"\">전체</button>'+P.staff.map(s=>'<button class=\"chip '+(s.id===focus?'on':'')+'\" data-id=\"'+esc(s.id)+'\">'+esc(s.name)+'</button>').join('');" +
      "let cal=DOW.map((d,i)=>'<div class=\"dow '+(i===0?'sun':i===6?'sat':'')+'\">'+d+'</div>').join('');for(let i=0;i<(P.days[0]?P.days[0].dow:0);i++)cal+='<div></div>';" +
      "if(!focus){P.days.forEach((day,i)=>{const buckets={D:[],E:[],N:[],OFF:[]};P.staff.forEach(s=>{const shift=(P.grid[s.id]||[])[i]||'OFF';const code=shift==='D'||shift==='E'||shift==='N'?shift:'OFF';buckets[code].push('<button class=\"who '+code+'\" data-id=\"'+esc(s.id)+'\">'+esc(s.name)+'</button>');});let lists=['D','E','N','OFF'].map(code=>buckets[code].length?'<div><span class=\"badge '+code+'\">'+(code==='OFF'?'오프':code)+'</span>'+buckets[code].join('')+'</div>':'').join('');cal+='<div class=\"day all\" style=\"'+(day.iso===today?'outline:2px solid #0e6b66':'')+'\"><b class=\"'+(day.dow===0||day.holiday?'sun':day.dow===6?'sat':'')+'\">'+day.n+'</b>'+lists+'</div>';});" +
      "document.getElementById('view').innerHTML='<p class=\"sub\">'+P.year+'년 '+P.month+'월</p><h1>'+esc(P.ward)+'</h1><div class=\"legend\"><span class=\"badge D\">데이 '+esc(shifts.D.start)+'–'+esc(shifts.D.end)+'</span><span class=\"badge E\">이브닝 '+esc(shifts.E.start)+'–'+esc(shifts.E.end)+'</span><span class=\"badge N\">나이트 '+esc(shifts.N.start)+'–'+esc(shifts.N.end)+'</span></div><div class=\"card\"><div class=\"chips\">'+chips+'</div><h2 style=\"margin:8px 0\">전체 달력</h2><div class=\"cal-scroll\"><div class=\"cal all\">'+cal+'</div></div><p class=\"sub\">이름을 누르면 그 사람 달력만 보입니다.</p></div>';}" +
      "else{const person=P.staff.find(s=>s.id===focus)||P.staff[0];const row=P.grid[person.id]||[];const req=new Set((P.requests&&P.requests[person.id])||[]);" +
      "P.days.forEach((day,i)=>{const shift=row[i]||'OFF';const requested=req.has(day.iso)&&shift==='OFF';cal+='<div class=\"day\" style=\"'+(day.iso===today?'outline:2px solid #0e6b66':'')+'\"><b class=\"'+(day.dow===0||day.holiday?'sun':day.dow===6?'sat':'')+'\">'+day.n+'</b><span class=\"badge '+(requested?'REQ':shift)+'\">'+(requested?'신청':name(shift))+'</span></div>';});" +
      "document.getElementById('view').innerHTML='<p class=\"sub\">'+P.year+'년 '+P.month+'월</p><h1>'+esc(P.ward)+'</h1><div class=\"legend\"><span class=\"badge D\">데이 '+esc(shifts.D.start)+'–'+esc(shifts.D.end)+'</span><span class=\"badge E\">이브닝 '+esc(shifts.E.start)+'–'+esc(shifts.E.end)+'</span><span class=\"badge N\">나이트 '+esc(shifts.N.start)+'–'+esc(shifts.N.end)+'</span></div><div class=\"card\"><div class=\"chips\">'+chips+'</div><h2 style=\"margin:8px 0\">'+esc(person.name)+' · '+esc(person.role)+'</h2><div class=\"cal\">'+cal+'</div><p class=\"sub\">이름을 누르면 그 사람 달력만 보입니다.</p></div>';}" +
      "document.querySelectorAll('[data-id]').forEach(btn=>btn.onclick=()=>{focus=btn.dataset.id||'';draw()});}" +
      "draw();</script></body></html>";
  }

  function renderViewer(payload) {
    document.title = payload.ward + " " + payload.month + "월 근무표";
    let focus = payload.focus || "";
    function draw() {
      const person = payload.staff.find(function (item) { return item.id === focus; });
      const chips = '<button class="chip' + (!person ? " on" : "") + '" type="button" data-view="">전체</button>' +
        payload.staff.map(function (item) {
          return '<button class="chip' + (person && item.id === person.id ? " on" : "") + '" type="button" data-view="' + esc(item.id) + '">' + esc(item.name) + "</button>";
        }).join("");
      let calendar = "";
      if (!person) {
        calendar = '<div class="cal-scroll">' + '<div class="cal all">' +
          DOW.map(function (name, index) { return '<div class="dow ' + (index === 0 ? "sun" : index === 6 ? "sat" : "") + '">' + name + "</div>"; }).join("") +
          new Array(payload.days[0].dow).fill('<div class="day out"></div>').join("") +
          payload.days.map(function (day, index) {
            return '<div class="day all' + (day.iso === todayIso() ? " today" : "") + " " + (day.dow === 0 ? "sun" : day.dow === 6 ? "sat" : "") + '"><div class="day-top"><span class="n">' + day.n + "</span>" +
              (day.holiday ? "<small>" + esc(day.holiday) + "</small>" : "") + "</div>" +
              namesForDay(payload.staff, payload.grid, payload.requests || {}, day, index, "") + "</div>";
          }).join("") + "</div></div>";
      } else {
        const row = payload.grid[person.id] || [];
        const req = new Set((payload.requests && payload.requests[person.id]) || []);
        calendar = '<div class="person-head"><div><strong>' + esc(person.name) + '</strong> <span class="role-tag">' + esc(person.role) + "</span></div></div>" +
          '<div class="cal">' + DOW.map(function (name, index) { return '<div class="dow ' + (index === 0 ? "sun" : index === 6 ? "sat" : "") + '">' + name + "</div>"; }).join("") +
          new Array(payload.days[0].dow).fill('<div class="day out"></div>').join("") +
          payload.days.map(function (day, index) {
            const shift = row[index] || "OFF";
            const requested = req.has(day.iso) && shift === "OFF";
            return '<div class="day' + (day.iso === todayIso() ? " today" : "") + '"><span class="n">' + day.n + '</span><span class="badge ' + (requested ? "REQ" : shift) + '">' + mark(shift, requested) + "</span><small>" + esc(day.holiday || "") + "</small></div>";
          }).join("") + "</div>";
      }
      root.innerHTML = '<main class="wrap"><p class="eyebrow">보기 전용</p><h1>' + esc(payload.ward) + '</h1><p class="sub">' + payload.year + "년 " + payload.month + "월 · 오늘 " + todayIso().slice(5).replace("-", "월 ") + '일</p>' +
        '<section class="card"><div class="legend"><span class="badge D">데이 ' + esc(payload.shifts.D.start) + "–" + esc(payload.shifts.D.end) + '</span><span class="badge E">이브닝 ' + esc(payload.shifts.E.start) + "–" + esc(payload.shifts.E.end) + '</span><span class="badge N">나이트 ' + esc(payload.shifts.N.start) + "–" + esc(payload.shifts.N.end) + "</span></div>" +
        '<div class="chips">' + chips + "</div>" + calendar + '<p class="help">이름을 누르면 그 사람 달력만 보입니다.</p></section></main>';
      root.querySelectorAll("[data-view], .who").forEach(function (button) {
        button.onclick = function () {
          focus = button.getAttribute("data-view") || button.getAttribute("data-id") || "";
          draw();
        };
      });
    }
    draw();
  }

  function findStaff(id) { return app.staff.find(function (person) { return person.id === id; }); }
  function moveStaff(id, dir) {
    const index = app.staff.findIndex(function (person) { return person.id === id; });
    const next = index + dir;
    if (index < 0 || next < 0 || next >= app.staff.length) return;
    const item = app.staff.splice(index, 1)[0];
    app.staff.splice(next, 0, item);
  }

  async function generate() {
    if (!app.staff.length) { ui.flash = "근무자를 먼저 추가해 주세요."; ui.tab = "인원"; return; }
    if (app.staff.some(function (person) { return !person.name.trim(); })) { ui.flash = "이름이 비어 있는 근무자가 있습니다."; ui.tab = "인원"; return; }
    if (!hasOffPeople()) {
      window.alert("오프인원을 먼저 넣어야합니다");
      ui.tab = "근무표";
      ui.flash = "오프인원을 먼저 넣어야합니다";
      return;
    }
    if (app.schedules[currentKey()] && !window.confirm("이번 달 근무표를 다시 만들까요? 손으로 고친 칸도 바뀝니다.")) return;
    applyAllOffPeople();
    ui.busy = true;
    renderEditor();
    try {
      await new Promise(function (resolve) { setTimeout(resolve, 40); });
      const days = buildDays(app.year, app.month);
      const linked = carryChain().length > 0;
      const result = window.RosterScheduler.generateRoster(schedulerInput(days));
      app.schedules[currentKey()] = result.grid;
      ui.focusId = app.staff[0].id;
      ui.showAll = window.matchMedia("(min-width: 900px)").matches;
      ui.tab = "근무표";
      ui.flash = linked ? "지난달 마지막 근무를 이어서 만들었습니다." : "지난달 근무표가 없어 1일부터 새로 만들었습니다.";
      save();
    } catch (err) {
      ui.flash = "근무표를 만들지 못했습니다. 인원과 오프 신청을 다시 확인해 주세요.";
    }
    ui.busy = false;
  }

  async function copyLink(focus) {
    const packed = await packPayload(viewPayload(focus));
    const url = location.href.split("#")[0] + "#v1." + packed + (focus ? "~" + focus : "");
    try {
      await navigator.clipboard.writeText(url);
      ui.flash = "링크를 복사했습니다.";
      ui.linkFallback = "";
    } catch (err) {
      ui.flash = "자동 복사가 막혀 있습니다. 아래 주소를 길게 눌러 복사해 주세요.";
      ui.linkFallback = url;
    }
  }

  function onClick(event) {
    const button = event.target.closest("[data-act]");
    if (!button) return;
    const act = button.dataset.act;
    const id = button.dataset.id;
    ui.flash = "";
    if (act === "tab") { ui.tab = button.dataset.tab; window.scrollTo(0, 0); }
    else if (act === "prev-month" || act === "next-month") {
      const delta = act === "next-month" ? 1 : -1;
      const index = app.year * 12 + app.month - 1 + delta;
      app.year = Math.floor(index / 12);
      app.month = (index % 12) + 1;
      save();
    } else if (act === "add-staff") {
      if (app.staff.length >= 999) { ui.flash = "근무자는 999명까지입니다."; }
      else app.staff.push({ id: uid(), name: "근무자" + (app.staff.length + 1), role: "신규" });
      save();
    } else if (act === "del-staff") {
      const person = findStaff(id);
      if (person && window.confirm(person.name + " 님을 목록에서 뺄까요?")) app.staff = app.staff.filter(function (item) { return item.id !== id; });
      save();
    } else if (act === "up") { moveStaff(id, -1); save(); }
    else if (act === "down") { moveStaff(id, 1); save(); }
    else if (act === "add-off-person") {
      const nameBox = document.getElementById("off-person-name");
      const dateBox = document.getElementById("off-person-date");
      const name = ((nameBox && nameBox.value) || ui.offDraft || "").trim();
      const date = ((dateBox && dateBox.value) || ui.offDateDraft || "").trim();
      if (!name) { ui.flash = "이름을 입력해 주세요."; }
      else if (!date) { ui.flash = "날짜를 선택해 주세요."; window.alert("날짜를 선택해 주세요."); }
      else if (!findStaffByName(name)) {
        ui.flash = "인원 탭에 있는 이름을 입력해 주세요.";
        window.alert("인원 탭에 있는 이름을 입력해 주세요.");
      } else {
        normalizeOffPeople();
        const exists = app.offPeople.some(function (item) { return item.name === name && item.date === date; });
        if (!exists) app.offPeople.push({ name: name, date: date });
        lockOffRequest(name, date);
        ui.offDraft = "";
        ui.offDateDraft = date;
        if (nameBox) nameBox.value = "";
        save();
      }
    } else if (act === "remove-off-person") {
      normalizeOffPeople();
      const index = Number(button.dataset.index);
      const item = app.offPeople[index];
      if (item) {
        unlockOffRequest(item.name, item.date);
        app.offPeople.splice(index, 1);
        save();
      }
    } else if (act === "pick" || act === "focus") { ui.focusId = id; ui.showAll = act === "focus" ? false : ui.showAll; }
    else if (act === "toggle-off") {
      const dates = requestsFor(id);
      const iso = button.dataset.iso;
      const at = dates.indexOf(iso);
      if (at >= 0) dates.splice(at, 1); else dates.push(iso);
      setRequests(id, dates.sort());
      save();
    } else if (act === "hide-holiday") {
      if (button.dataset.extra === "1") app.extraHolidays = app.extraHolidays.filter(function (item) { return item.date !== button.dataset.iso; });
      else if (app.removedHolidays.indexOf(button.dataset.iso) < 0) app.removedHolidays.push(button.dataset.iso);
      save();
    } else if (act === "restore-holiday") {
      app.removedHolidays = app.removedHolidays.filter(function (iso) { return iso !== button.dataset.iso; });
      save();
    } else if (act === "add-holiday") {
      const date = document.getElementById("holidate").value;
      const name = document.getElementById("holiname").value.trim() || "휴무";
      if (!date) { ui.flash = "날짜를 선택해 주세요."; }
      else {
        app.removedHolidays = app.removedHolidays.filter(function (iso) { return iso !== date; });
        app.extraHolidays = app.extraHolidays.filter(function (item) { return item.date !== date; });
        if (!HOLIDAYS[date]) app.extraHolidays.push({ date: date, name: name });
        save();
      }
    } else if (act === "generate") { generate().then(renderEditor); return; }
    else if (act === "toggle-all") { ui.showAll = !ui.showAll; if (!ui.showAll) ui.editGrid = false; }
    else if (act === "edit-grid") ui.editGrid = !ui.editGrid;
    else if (act === "every-row") ui.showEveryRow = true;
    else if (act === "more-warn") ui.moreWarn = !ui.moreWarn;
    else if (act === "toggle-fair") ui.showFair = !ui.showFair;
    else if (act === "cycle") {
      const grid = app.schedules[currentKey()] && app.schedules[currentKey()][id];
      if (grid) {
        const order = ["OFF", "D", "E", "N"];
        const at = order.indexOf(grid[Number(button.dataset.day)]);
        grid[Number(button.dataset.day)] = order[(at + 1) % order.length];
        save();
      }
    } else if (act === "download-all" || act === "download-one") {
      const focus = act === "download-one" ? id : "";
      const person = focus ? findStaff(focus) : null;
      download(safeName((app.wardName || "근무표") + "_" + currentKey() + (person ? "_" + person.name : "")) + ".html", shareDocument(viewPayload(focus)), "text/html");
      ui.flash = "파일을 저장했습니다. 그 파일을 근무자에게 보내 주세요.";
    } else if (act === "copy-all" || act === "copy-one") { copyLink(act === "copy-one" ? id : "").then(renderEditor); return; }
    else if (act === "backup") {
      download(safeName((app.wardName || "근무표") + "_백업") + ".json", JSON.stringify(app), "application/json");
      ui.flash = "백업 파일을 저장했습니다.";
    }     else if (act === "pick-restore") { document.getElementById("restore").click(); return; }
    renderEditor();
  }

  function onChange(event) {
    const el = event.target;
    if (el.id === "ward") app.wardName = el.value.trim();
    else if (el.dataset.shift) app.shifts[el.dataset.shift][el.dataset.part] = el.value;
    else if (el.dataset.roleKind) {
      const person = findStaff(el.dataset.roleKind);
      if (person) {
        if (el.value === "선임" || el.value === "신규") {
          person.role = el.value;
          ui.editingYearsId = "";
        } else {
          const kept = roleKind(person.role) === "년차" ? roleYears(person.role) : "";
          person.role = roleFromParts("년차", kept || "1");
          ui.editingYearsId = person.id;
        }
      }
    } else if (el.dataset.staff) {
      const person = findStaff(el.dataset.staff);
      if (person) person[el.dataset.prop] = el.dataset.prop === "name" ? el.value.trim() : el.value;
    } else if (el.id === "restore" && el.files && el.files[0]) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.staff)) throw new Error("형식");
          app = Object.assign(defaultApp(), data);
          save();
          ui.flash = "백업을 불러왔습니다.";
        } catch (err) { ui.flash = "백업 파일을 읽지 못했습니다."; }
        renderEditor();
      };
      reader.readAsText(el.files[0]);
      return;
    } else return;
    save();
    renderEditor();
  }
  function onInput(event) {
    if (event.target.id === "find") {
      ui.query = event.target.value;
      const pos = event.target.selectionStart;
      renderEditor();
      const box = document.getElementById("find");
      if (box) { box.focus(); box.selectionStart = box.selectionEnd = pos; }
    } else if (event.target.id === "sharefind") {
      ui.shareQuery = event.target.value;
      const pos = event.target.selectionStart;
      renderEditor();
      const box = document.getElementById("sharefind");
      if (box) { box.focus(); box.selectionStart = box.selectionEnd = pos; }
    } else if (event.target.id === "off-person-name") {
      ui.offDraft = event.target.value;
    } else if (event.target.id === "off-person-date") {
      ui.offDateDraft = event.target.value;
    } else if (event.target.dataset.roleYears) {
      const person = findStaff(event.target.dataset.roleYears);
      if (!person) return;
      const value = String(event.target.value || "").trim();
      if (!value) return;
      person.role = roleFromParts("년차", value);
      ui.editingYearsId = "";
      save();
      renderEditor();
      const select = document.querySelector('[data-role-kind="' + person.id + '"]');
      if (select) select.focus();
    }
  }

  function bootHash(raw) {
    const cut = raw.lastIndexOf("~");
    let packed = raw;
    let focus = "";
    if (cut > 1 && raw.slice(cut + 1).charAt(0) === "s") {
      packed = raw.slice(0, cut);
      focus = raw.slice(cut + 1);
    }
    root.innerHTML = '<main class="wrap"><p>근무표를 열고 있습니다.</p></main>';
    unpackPayload(packed).then(function (payload) {
      if (focus) payload.focus = focus;
      renderViewer(payload);
    }).catch(function () {
      root.innerHTML = '<main class="wrap"><h1>근무표를 열지 못했습니다</h1><p class="help">링크가 잘렸거나 파일이 바뀌었습니다. 근무표를 만든 사람에게 파일을 다시 받아 주세요.</p></main>';
    });
  }

  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  if (location.hash.indexOf("#v1.") === 0) bootHash(decodeURIComponent(location.hash.slice(4)));
  else renderEditor();
})();
