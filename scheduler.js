(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RosterScheduler = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SHIFTS = ["D", "E", "N"];

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function freshState() {
    return {
      last: "OFF",
      workStreak: 0,
      sameStreak: 0,
      blockTypes: [],
      restOwed: 0,
      nights: 0,
      baseOffPlaced: 0,
      weekendBaseOff: 0,
      weekdayBaseOff: 0,
    };
  }

  function cloneState(state) {
    return {
      last: state.last,
      workStreak: state.workStreak,
      sameStreak: state.sameStreak,
      blockTypes: state.blockTypes.slice(),
      restOwed: state.restOwed,
      nights: state.nights,
      baseOffPlaced: state.baseOffPlaced,
      weekendBaseOff: state.weekendBaseOff,
      weekdayBaseOff: state.weekdayBaseOff,
    };
  }

  function beginMonth(state) {
    const next = cloneState(state || freshState());
    next.nights = 0;
    next.baseOffPlaced = 0;
    next.weekendBaseOff = 0;
    next.weekdayBaseOff = 0;
    return next;
  }

  function applyShift(state, shift, isWeekendLike, isRequested) {
    if (shift === "OFF") {
      const startingRest =
        state.restOwed === 0 && (state.last === "N" || state.sameStreak >= 3);
      if (state.restOwed > 0) state.restOwed -= 1;
      else if (startingRest) state.restOwed = 1;
      if (!isRequested) {
        state.baseOffPlaced += 1;
        if (isWeekendLike) state.weekendBaseOff += 1;
        else state.weekdayBaseOff += 1;
      }
      state.workStreak = 0;
      state.sameStreak = 0;
      state.blockTypes = [];
      state.last = "OFF";
      return;
    }

    if (state.workStreak === 0) state.blockTypes = [shift];
    else if (state.blockTypes.indexOf(shift) === -1) state.blockTypes = state.blockTypes.concat(shift);
    state.workStreak += 1;
    state.sameStreak = state.last === shift ? state.sameStreak + 1 : 1;
    state.last = shift;
    if (shift === "N") state.nights += 1;
    if (state.sameStreak >= 3) state.restOwed = 2;
  }

  function canAssign(state, shift) {
    if (shift === "OFF") return true;
    if (state.restOwed > 0) return false;
    if (state.last === "E" && shift === "D") return false;
    if (state.last === "N" && shift !== "N") return false;
    if (shift === "N" && state.nights >= 6) return false;
    if (state.workStreak >= 5) return false;
    if (state.last === shift && state.sameStreak >= 3) return false;
    const types = state.workStreak === 0 ? [] : state.blockTypes;
    if (types.indexOf(shift) === -1 && types.length >= 2) return false;
    return true;
  }

  function blockReason(state, shift) {
    if (state.restOwed > 0) return "쉬어야 하는 날인데 근무가 들어갔습니다";
    if (state.last === "E" && shift === "D") return "이브닝 다음 날에는 데이를 넣을 수 없습니다";
    if (state.last === "N" && shift !== "N") return "나이트 다음 날에는 데이·이브닝을 넣을 수 없습니다";
    if (shift === "N" && state.nights >= 6) return "이번 달 나이트가 6개를 넘습니다";
    if (state.workStreak >= 5) return "연속 근무가 5일을 넘습니다";
    if (state.last === shift && state.sameStreak >= 3) return "같은 근무를 3일 넘게 이었습니다";
    const types = state.workStreak === 0 ? [] : state.blockTypes;
    if (types.indexOf(shift) === -1 && types.length >= 2) {
      return "오프와 오프 사이에 데이·이브닝·나이트가 모두 들어갔습니다";
    }
    return "근무 규칙을 벗어났습니다";
  }

  function budgetAllows(state, shift, baseOffTarget, daysAfter) {
    const completesTriple = state.last === shift && state.sameStreak >= 2;
    const startsNight = shift === "N" && state.last !== "N";
    if (!completesTriple && !startsNight) return true;
    const need = Math.min(2, daysAfter);
    return baseOffTarget - state.baseOffPlaced >= need;
  }

  function carryState(chain, staffId) {
    let state = freshState();
    chain.forEach(function (month) {
      const shifts = month.grid && month.grid[staffId];
      if (!shifts) {
        state = freshState();
        return;
      }
      for (let i = 0; i < shifts.length; i++) {
        applyShift(state, shifts[i], !!(month.weekendLike && month.weekendLike[i]), false);
      }
    });
    return beginMonth(state);
  }

  function historyStats(chain, staffId) {
    const stats = { weekendOffs: 0, weekdayOffs: 0, nights: 0, weekendWorks: 0, weekdayWorks: 0 };
    chain.slice(-11).forEach(function (month) {
      const shifts = month.grid && month.grid[staffId];
      if (!shifts) return;
      for (let i = 0; i < shifts.length; i++) {
        const weekend = !!(month.weekendLike && month.weekendLike[i]);
        if (shifts[i] === "OFF") {
          if (weekend) stats.weekendOffs += 1;
          else stats.weekdayOffs += 1;
        } else if (weekend) {
          stats.weekendWorks += 1;
          if (shifts[i] === "N") stats.nights += 1;
        } else {
          stats.weekdayWorks += 1;
          if (shifts[i] === "N") stats.nights += 1;
        }
      }
    });
    return stats;
  }

  function flexRemaining(requestSet, day, days) {
    let count = 0;
    for (let d = day; d < days; d++) if (!requestSet.has(d)) count += 1;
    return count;
  }

  function planTargets(input) {
    const weekendLike = input.weekendLike;
    const days = weekendLike.length;
    const staffCount = input.staffCount;
    const weDays = weekendLike.filter(Boolean).length;
    const wdDays = days - weDays;
    const baseOffTarget = input.baseOffTarget;
    const avg = days ? (staffCount * (days - baseOffTarget)) / days : 0;
    let wd;
    let we;
    const custom = input.weekdayTarget > 0 && input.weekendTarget > 0;
    if (custom) {
      wd = input.weekdayTarget;
      we = input.weekendTarget;
    } else {
      we = Math.round(avg * 0.75);
      wd = wdDays ? Math.round((avg * days - we * weDays) / wdDays) : we;
    }
    const floorHead = staffCount >= 3 ? 3 : Math.max(1, staffCount);
    wd = clamp(Math.round(wd), floorHead, Math.max(floorHead, staffCount));
    we = clamp(Math.round(we), floorHead, Math.max(floorHead, staffCount));
    if (!custom && wd <= we && staffCount > 1) {
      if (wd < staffCount) wd += 1;
      if (wd <= we) we = Math.max(floorHead, wd - 1);
    }
    const maxN = Math.max(1, Math.floor((6 * Math.max(1, staffCount)) / Math.max(1, days)));
    const perDay = weekendLike.map(function (isWeekend) {
      return splitTarget(isWeekend ? we : wd, maxN, staffCount);
    });
    return { weekdayTotal: wd, weekendTotal: we, maxN: maxN, perDay: perDay, average: avg };
  }

  function splitTarget(total, maxN, staffCount) {
    total = clamp(total, 0, staffCount);
    if (total <= 0) return { D: 0, E: 0, N: 0, total: 0 };
    if (total === 1) return { D: 1, E: 0, N: 0, total: 1 };
    if (total === 2) return { D: 1, E: 1, N: 0, total: 2 };
    let nights = clamp(Math.round(total * 0.28), 1, Math.min(maxN, total - 2));
    let rest = total - nights;
    let day = Math.max(1, Math.ceil(rest / 2));
    let evening = rest - day;
    if (evening < 1) {
      evening = 1;
      day = Math.max(1, rest - 1);
    }
    if (day + evening + nights !== total) {
      nights = total - day - evening;
    }
    return { D: day, E: evening, N: Math.max(1, nights), total: total };
  }

  function offPlanForPerson(baseOffTarget, requestSet, weekendLike, history, avgWeekendOffs) {
    let maxWeekend = 0;
    let maxWeekday = 0;
    for (let i = 0; i < weekendLike.length; i++) {
      if (requestSet.has(i)) continue;
      if (weekendLike[i]) maxWeekend += 1;
      else maxWeekday += 1;
    }
    let targetWeekend = Math.round(baseOffTarget * 0.5);
    const pastWeekend = history ? history.weekendOffs : 0;
    if (avgWeekendOffs > 0 || pastWeekend > 0) {
      if (pastWeekend > avgWeekendOffs + 1) targetWeekend -= 1;
      if (pastWeekend < avgWeekendOffs - 1) targetWeekend += 1;
    }
    targetWeekend = clamp(targetWeekend, 0, Math.min(baseOffTarget, maxWeekend));
    let targetWeekday = baseOffTarget - targetWeekend;
    if (targetWeekday > maxWeekday) {
      const spill = targetWeekday - maxWeekday;
      targetWeekday = maxWeekday;
      targetWeekend = Math.min(maxWeekend, targetWeekend + spill);
    }
    return { targetWeekend: targetWeekend, targetWeekday: baseOffTarget - targetWeekend };
  }

  function legalShifts(state, baseOffTarget, daysAfter) {
    return SHIFTS.filter(function (shift) {
      return canAssign(state, shift) && budgetAllows(state, shift, baseOffTarget, daysAfter);
    });
  }

  function scoreShift(state, shift, person, ctx) {
    let score = ctx.rng() * 2;
    if (state.last === shift && state.sameStreak < 3) score += shift === "N" ? 28 : 6;
    if (state.workStreak >= 4) score -= 6;
    if (shift === "N") {
      score -= state.nights * 6;
      score -= (person.histNights || 0) * 0.8;
      if (state.workStreak === 0) score += 3;
      else if (state.last !== "N") score -= 2;
      if ((person.histNights || 0) > ctx.avgHistNights + 1) score -= 3;
      if (state.last !== "N" && state.nights >= 4 && ctx.dayProgress < 0.55) score -= 10;
      if (ctx.dayProgress > 0.6 && state.nights < 4) score += 12;
      if (ctx.dayProgress > 0.75 && state.nights < 5) score += 8;
    }
    if (person.role === "선임" || person.role === "5년차") {
      const onShift = ctx.roleOnShift(shift, person.role);
      const onDay = ctx.roleOnDay(person.role);
      if (!onDay) score += 4;
      else if (!onShift) score += 2;
    }
    return score;
  }

  function workDesire(state, person, day, days, weekendLike, requestSet, rng) {
    const baseStill = person.baseOffTarget - state.baseOffPlaced;
    const flex = flexRemaining(requestSet, day, days);
    const offFrac = flex ? baseStill / flex : 0;
    let score = 2 - offFrac * 5 + rng() * 2;
    if (weekendLike[day]) {
      if (state.weekendBaseOff < person.targetWeekend) score -= 7;
      else score += 5;
    } else if (state.weekdayBaseOff < person.targetWeekday) score -= 3;
    else score += 4;
    if (person.role === "선임" || person.role === "5년차") score += 1;
    if (state.last === "N" && state.sameStreak < 3 && state.nights < 6) score += 8;
    else if ((state.last === "D" || state.last === "E") && state.sameStreak > 0 && state.sameStreak < 3 && state.workStreak < 4) {
      score += 2;
    }
    if (state.workStreak >= 4 && !(state.last === "N" && state.sameStreak < 3)) score -= 7;
    if (state.workStreak >= 3 && state.last !== "N") score -= 2;
    return score;
  }

  function buildOnce(input, rng) {
    const staff = input.staff;
    const days = input.weekendLike.length;
    const baseOffTarget = input.baseOffTarget;
    const targets = input.dayTargets;
    const states = staff.map(function (person) {
      return beginMonth(input.carry[person.id] || freshState());
    });
    const requestSets = staff.map(function (person) {
      return new Set((input.requests[person.id] || []).filter(function (day) {
        return day >= 0 && day < days;
      }));
    });
    const grid = staff.map(function () {
      return new Array(days);
    });

    for (let day = 0; day < days; day++) {
      const daysAfter = days - day - 1;
      const assignment = new Array(staff.length).fill(null);
      const reason = new Array(staff.length).fill("");
      const target = targets[day];

      for (let i = 0; i < staff.length; i++) {
        const requestSet = requestSets[i];
        if (requestSet.has(day)) {
          assignment[i] = "OFF";
          reason[i] = "request";
          continue;
        }
        if (states[i].restOwed > 0) {
          assignment[i] = "OFF";
          reason[i] = "rest";
          continue;
        }
        const baseStill = baseOffTarget - states[i].baseOffPlaced;
        const flex = flexRemaining(requestSet, day, days);
        if (baseStill >= flex) reason[i] = "budget-pending";
      }

      ["선임", "5년차"].forEach(function (role) {
        const pending = [];
        for (let i = 0; i < staff.length; i++) {
          if (staff[i].role === role && reason[i] === "budget-pending") pending.push(i);
        }
        if (!pending.length) return;
        const alreadyCovered = staff.some(function (person, index) {
          return person.role === role && reason[index] !== "budget-pending" && assignment[index] !== "OFF";
        });
        if (!alreadyCovered && pending.length >= 1) {
          const keeper = pending[day % pending.length];
          reason[keeper] = "";
        }
      });
      for (let i = 0; i < staff.length; i++) {
        if (reason[i] === "budget-pending") {
          assignment[i] = "OFF";
          reason[i] = "budget";
        }
      }

      ["선임", "5년차"].forEach(function (role) {
        const open = [];
        for (let i = 0; i < staff.length; i++) {
          if (staff[i].role !== role || assignment[i] !== null) continue;
          if (states[i].last === "N") continue;
          if (states[i].sameStreak >= 2 && states[i].last !== "OFF") continue;
          open.push(i);
        }
        if (open.length < 2) return;
        const weekend = input.weekendLike[day];
        open.sort(function (a, b) {
          const needA = weekend
            ? staff[a].targetWeekend - states[a].weekendBaseOff
            : staff[a].targetWeekday - states[a].weekdayBaseOff;
          const needB = weekend
            ? staff[b].targetWeekend - states[b].weekendBaseOff
            : staff[b].targetWeekday - states[b].weekdayBaseOff;
          if (needB !== needA) return needB - needA;
          return (a + day) % 2 - ((b + day) % 2);
        });
        const pickIndex = open[0];
        const need = weekend
          ? staff[pickIndex].targetWeekend - states[pickIndex].weekendBaseOff
          : staff[pickIndex].targetWeekday - states[pickIndex].weekdayBaseOff;
        if (need > 0 && baseOffTarget - states[pickIndex].baseOffPlaced > 0) {
          assignment[pickIndex] = "OFF";
          reason[pickIndex] = "stagger";
        }
      });

      function unassigned() {
        const list = [];
        for (let i = 0; i < staff.length; i++) if (assignment[i] === null) list.push(i);
        return list;
      }

      function mateCanCover(role, self, ahead) {
        const future = day + ahead;
        if (future >= days) return true;
        let mates = 0;
        let free = 0;
        for (let j = 0; j < staff.length; j++) {
          if (j === self || staff[j].role !== role) continue;
          mates += 1;
          if (requestSets[j].has(future)) continue;
          if (ahead < states[j].restOwed) continue;
          if (states[j].last === "N" && states[j].restOwed === 0) continue;
          if (assignment[j] === "N") continue;
          if (
            assignment[j] &&
            assignment[j] !== "OFF" &&
            states[j].last === assignment[j] &&
            states[j].sameStreak === 2 &&
            ahead >= 1 &&
            ahead <= 2
          ) {
            continue;
          }
          free += 1;
        }
        return mates === 0 || free > 0;
      }

      function keepsRoleCover(i, shift) {
        const role = staff[i].role;
        if (role !== "선임" && role !== "5년차") return true;
        const startsNight = shift === "N" && states[i].last !== "N";
        const completesDayOrEvening = shift !== "N" && states[i].last === shift && states[i].sameStreak === 2;
        if (startsNight) {
          return mateCanCover(role, i, 1) && mateCanCover(role, i, 2) && mateCanCover(role, i, 3) && mateCanCover(role, i, 4);
        }
        if (!completesDayOrEvening) return true;
        return mateCanCover(role, i, 1) && mateCanCover(role, i, 2);
      }

      function tripleRoom(i, shift) {
        if (shift === "N") return true;
        if (!(states[i].last === shift && states[i].sameStreak === 2)) return true;
        let finishing = 0;
        for (let j = 0; j < staff.length; j++) {
          if (
            assignment[j] &&
            assignment[j] !== "OFF" &&
            assignment[j] !== "N" &&
            states[j].last === assignment[j] &&
            states[j].sameStreak === 2
          ) {
            finishing += 1;
          }
        }
        return finishing < Math.max(2, Math.floor(staff.length / 5));
      }

      function canTake(i, shift) {
        return (
          canAssign(states[i], shift) &&
          budgetAllows(states[i], shift, baseOffTarget, daysAfter) &&
          keepsRoleCover(i, shift) &&
          tripleRoom(i, shift)
        );
      }

      function roleOnShift(shift, role) {
        for (let i = 0; i < staff.length; i++) {
          if (assignment[i] === shift && staff[i].role === role) return true;
        }
        return false;
      }

      function roleOnDay(role) {
        for (let i = 0; i < staff.length; i++) {
          if (assignment[i] && assignment[i] !== "OFF" && staff[i].role === role) return true;
        }
        return false;
      }

      function pick(shift, count, pool) {
        const candidates = pool.filter(function (i) {
          return assignment[i] === null && canTake(i, shift);
        });
        candidates.sort(function (a, b) {
          const ctx = { rng: rng, avgHistNights: input.avgHistNights, dayProgress: day / days, roleOnShift: roleOnShift, roleOnDay: roleOnDay };
          return scoreShift(states[b], shift, staff[b], ctx) - scoreShift(states[a], shift, staff[a], ctx);
        });
        const chosen = candidates.slice(0, count);
        chosen.forEach(function (i) {
          assignment[i] = shift;
          reason[i] = "work";
        });
        return chosen.length;
      }

      const continueNight = unassigned().filter(function (i) {
        return states[i].last === "N" && canTake(i, "N");
      });
      pick("N", continueNight.length, continueNight);
      const nightNow = assignment.filter(function (shift) { return shift === "N"; }).length;
      if (nightNow < target.N) pick("N", target.N - nightNow, unassigned());
      pick("E", target.E, unassigned());
      pick("D", target.D, unassigned());

      unassigned()
        .filter(function (i) {
          return baseOffTarget - states[i].baseOffPlaced <= 0;
        })
        .sort(function (a, b) {
          return workDesire(states[b], staff[b], day, days, input.weekendLike, requestSets[b], rng) -
            workDesire(states[a], staff[a], day, days, input.weekendLike, requestSets[a], rng);
        })
        .forEach(function (i) {
          const options = legalShifts(states[i], baseOffTarget, daysAfter);
          if (!options.length) {
            assignment[i] = "OFF";
            reason[i] = "overflow";
            return;
          }
          options.sort(function (a, b) {
            const ctx = { rng: rng, avgHistNights: input.avgHistNights, dayProgress: day / days, roleOnShift: roleOnShift, roleOnDay: roleOnDay };
            const countBias = function (shift) {
              const count = assignment.filter(function (value) { return value === shift; }).length;
              const goal = target[shift] || 0;
              return count < goal ? 6 : -count;
            };
            return scoreShift(states[i], b, staff[i], ctx) + countBias(b) - (scoreShift(states[i], a, staff[i], ctx) + countBias(a));
          });
          assignment[i] = options[0];
          reason[i] = "work";
        });

      function countShift(shift) {
        return assignment.filter(function (value) { return value === shift; }).length;
      }

      SHIFTS.forEach(function (short) {
        let guard = 0;
        while (countShift(short) < target[short] && guard < staff.length) {
          guard += 1;
          const idle = unassigned().filter(function (i) { return canTake(i, short); });
          if (idle.length) {
            idle.sort(function (a, b) {
              return workDesire(states[b], staff[b], day, days, input.weekendLike, requestSets[b], rng) -
                workDesire(states[a], staff[a], day, days, input.weekendLike, requestSets[a], rng);
            });
            assignment[idle[0]] = short;
            reason[idle[0]] = "work";
            continue;
          }
          let moved = false;
          for (let s = 0; s < SHIFTS.length && !moved; s++) {
            const extra = SHIFTS[s];
            if (extra === short || countShift(extra) <= 1) continue;
            const donors = [];
            for (let i = 0; i < staff.length; i++) if (assignment[i] === extra && canTake(i, short)) donors.push(i);
            if (!donors.length) continue;
            donors.sort(function (a, b) {
              const ctx = { rng: rng, avgHistNights: input.avgHistNights, dayProgress: day / days, roleOnShift: roleOnShift, roleOnDay: roleOnDay };
              return scoreShift(states[b], short, staff[b], ctx) - scoreShift(states[a], short, staff[a], ctx);
            });
            const donor = donors[0];
            const replacement = unassigned().find(function (i) { return canTake(i, extra); });
            assignment[donor] = short;
            if (replacement !== undefined) {
              assignment[replacement] = extra;
              reason[replacement] = "work";
            }
            moved = true;
          }
          if (!moved) break;
        }
      });

      const minWanted = Math.min(5, staff.length, staff.length - reason.filter(function (value) {
        return value === "request" || value === "rest" || value === "budget";
      }).length);
      let guardPull = 0;
      while (countShift("D") + countShift("E") + countShift("N") < Math.max(target.total, minWanted) && guardPull < staff.length) {
        guardPull += 1;
        const idle = unassigned().filter(function (i) { return legalShifts(states[i], baseOffTarget, daysAfter).length; });
        if (!idle.length) break;
        idle.sort(function (a, b) {
          return workDesire(states[b], staff[b], day, days, input.weekendLike, requestSets[b], rng) -
            workDesire(states[a], staff[a], day, days, input.weekendLike, requestSets[a], rng);
        });
        const i = idle[0];
        const options = legalShifts(states[i], baseOffTarget, daysAfter).slice().sort(function (a, b) {
          return countShift(a) - countShift(b);
        });
        assignment[i] = options[0];
        reason[i] = "work";
      }

      for (let i = 0; i < staff.length; i++) {
        if (assignment[i] === null) {
          assignment[i] = "OFF";
          reason[i] = "choice";
        }
      }

      function canTakeBare(i, shift) {
        if (requestSets[i].has(day)) return false;
        if (reason[i] === "request" || reason[i] === "rest") return false;
        return !!canAssign(states[i], shift);
      }
      function pickForEmpty(shift, preferOff) {
        const pool = [];
        for (let i = 0; i < staff.length; i++) {
          if (preferOff && assignment[i] !== "OFF") continue;
          if (!preferOff && (assignment[i] === "OFF" || assignment[i] === shift)) continue;
          if (!canTake(i, shift) && !canTakeBare(i, shift)) continue;
          if (!preferOff && countShift(assignment[i]) <= 1) continue;
          pool.push(i);
        }
        if (!pool.length) return false;
        pool.sort(function (a, b) {
          const coverA = canTake(a, shift) ? 10 : 0;
          const coverB = canTake(b, shift) ? 10 : 0;
          return coverB - coverA ||
            workDesire(states[b], staff[b], day, days, input.weekendLike, requestSets[b], rng) -
            workDesire(states[a], staff[a], day, days, input.weekendLike, requestSets[a], rng);
        });
        assignment[pool[0]] = shift;
        reason[pool[0]] = "work";
        return true;
      }
      function fillEmptyShifts() {
        ["N", "D", "E"].forEach(function (shift) {
          if (countShift(shift) > 0) return;
          if (pickForEmpty(shift, true)) return;
          if (pickForEmpty(shift, false)) return;
        });
      }
      fillEmptyShifts();
      fillEmptyShifts();

      ["선임", "5년차"].forEach(function (role) {
        if (!staff.some(function (person) { return person.role === role; })) return;
        if (roleOnDay(role)) {
          spreadRole(role);
          return;
        }
        const candidates = [];
        for (let i = 0; i < staff.length; i++) {
          if (staff[i].role !== role || reason[i] !== "choice") continue;
          if (!legalShifts(states[i], baseOffTarget, daysAfter).length) continue;
          candidates.push(i);
        }
        if (!candidates.length) return;
        const candidate = candidates[0];
        let victim = -1;
        const options = legalShifts(states[candidate], baseOffTarget, daysAfter);
        for (let i = 0; i < staff.length; i++) {
          if (reason[i] !== "work") continue;
          if (staff[i].role === "선임" || staff[i].role === "5년차") continue;
          if (baseOffTarget - states[i].baseOffPlaced <= 0) continue;
          if (options.indexOf(assignment[i]) === -1) continue;
          victim = i;
          break;
        }
        if (victim >= 0) {
          assignment[candidate] = assignment[victim];
          reason[candidate] = "work";
          assignment[victim] = "OFF";
          reason[victim] = "choice";
        } else {
          options.sort(function (a, b) { return countShift(a) - countShift(b); });
          assignment[candidate] = options[0];
          reason[candidate] = "work";
        }
        spreadRole(role);
      });

      function spreadRole(role) {
        SHIFTS.forEach(function (shift) {
          if (countShift(shift) === 0 || roleOnShift(shift, role)) return;
          const donors = [];
          SHIFTS.forEach(function (from) {
            if (from === shift) return;
            let roleCount = 0;
            for (let i = 0; i < staff.length; i++) if (assignment[i] === from && staff[i].role === role) roleCount += 1;
            if (roleCount < 2) return;
            for (let i = 0; i < staff.length; i++) {
              if (assignment[i] === from && staff[i].role === role && canTake(i, shift)) donors.push(i);
            }
          });
          if (!donors.length) return;
          const mover = donors[0];
          const partners = [];
          for (let i = 0; i < staff.length; i++) {
            if (assignment[i] === shift && staff[i].role !== role && canTake(i, assignment[mover])) partners.push(i);
          }
          if (!partners.length) return;
          const partner = partners[0];
          const moverShift = assignment[mover];
          assignment[mover] = shift;
          assignment[partner] = moverShift;
        });
      }

      fillEmptyShifts();

      for (let i = 0; i < staff.length; i++) {
        grid[i][day] = assignment[i];
        applyShift(states[i], assignment[i], input.weekendLike[day], requestSets[i].has(day));
      }
    }

    const byId = {};
    staff.forEach(function (person, index) {
      byId[person.id] = grid[index].slice();
    });
    return byId;
  }

  function dateLabel(dayIndex) {
    return dayIndex + 1 + "일";
  }

  function assess(input, grid) {
    const staff = input.staff;
    const days = input.weekendLike.length;
    const hard = [];
    const soft = [];
    const dayStats = [];
    const peopleStats = [];
    let penalty = 0;

    for (let day = 0; day < days; day++) {
      const bucket = { D: 0, E: 0, N: 0, OFF: 0, senior: 0, year5: 0 };
      staff.forEach(function (person) {
        const shift = grid[person.id][day];
        bucket[shift] += 1;
        if (shift !== "OFF" && person.role === "선임") bucket.senior += 1;
        if (shift !== "OFF" && person.role === "5년차") bucket.year5 += 1;
      });
      const working = bucket.D + bucket.E + bucket.N;
      dayStats.push({
        working: working,
        D: bucket.D,
        E: bucket.E,
        N: bucket.N,
        off: bucket.OFF,
        senior: bucket.senior,
        year5: bucket.year5,
      });
      if (staff.length >= 5 && working < 5) {
        soft.push(dateLabel(day) + " 근무 인원이 " + working + "명입니다. 하루 5명 이상이 필요합니다.");
        penalty += 80;
      }
      if (staff.some(function (person) { return person.role === "선임"; }) && bucket.senior === 0) {
        soft.push(dateLabel(day) + " 근무하는 선임이 없습니다.");
        penalty += 70;
      }
      if (staff.some(function (person) { return person.role === "5년차"; }) && bucket.year5 === 0) {
        soft.push(dateLabel(day) + " 근무하는 5년차가 없습니다.");
        penalty += 70;
      }
      if (staff.length >= 3) {
        SHIFTS.forEach(function (shift) {
          if (bucket[shift] === 0) {
            const label = shift === "D" ? "데이" : shift === "E" ? "이브닝" : "나이트";
            soft.push(dateLabel(day) + " " + label + " 근무가 비어 있습니다.");
            penalty += 220;
          }
        });
      }
    }

    let weekdayWork = 0;
    let weekdayDays = 0;
    let weekendWork = 0;
    let weekendDays = 0;
    input.weekendLike.forEach(function (isWeekend, day) {
      if (isWeekend) {
        weekendWork += dayStats[day].working;
        weekendDays += 1;
      } else {
        weekdayWork += dayStats[day].working;
        weekdayDays += 1;
      }
    });
    const weekdayAvg = weekdayDays ? weekdayWork / weekdayDays : 0;
    const weekendAvg = weekendDays ? weekendWork / weekendDays : 0;
    if (weekdayDays && weekendDays && weekdayAvg <= weekendAvg) {
      soft.push(
        "평일 평균 " + weekdayAvg.toFixed(1) + "명, 주말·공휴일 평균 " +
          weekendAvg.toFixed(1) + "명입니다. 평일 인원이 더 많아야 합니다."
      );
      penalty += 100;
    }

    staff.forEach(function (person) {
      const shifts = grid[person.id];
      const requestSet = new Set(input.requests[person.id] || []);
      const state = beginMonth(input.carry[person.id] || freshState());
      for (let day = 0; day < days; day++) {
        const shift = shifts[day];
        const requested = requestSet.has(day);
        if (requested && shift !== "OFF") {
          hard.push(person.name + " 님 " + dateLabel(day) + " 신청 오프가 반영되지 않았습니다.");
          penalty += 10000;
        } else if (shift !== "OFF" && !canAssign(state, shift)) {
          hard.push(person.name + " 님 " + dateLabel(day) + " " + blockReason(state, shift) + ".");
          penalty += 10000;
        }
        applyShift(state, shift, input.weekendLike[day], requested);
      }
      const requestCount = requestSet.size;
      peopleStats.push({
        id: person.id,
        name: person.name,
        role: person.role,
        nights: state.nights,
        baseOff: state.baseOffPlaced,
        weekendOff: state.weekendBaseOff,
        weekdayOff: state.weekdayBaseOff,
        requestOff: requestCount,
        totalOff: state.baseOffPlaced + requestCount,
        targetWeekend: person.targetWeekend,
        targetWeekday: person.targetWeekday,
      });
      const offDiff = Math.abs(state.baseOffPlaced - input.baseOffTarget);
      if (offDiff) {
        soft.push(
          person.name + " 님 기본 오프가 " + state.baseOffPlaced + "일입니다. 목표는 " + input.baseOffTarget + "일입니다."
        );
        penalty += offDiff * 40;
      }
      const weekendDiff = Math.abs(state.weekendBaseOff - person.targetWeekend);
      if (weekendDiff >= 3) {
        soft.push(
          person.name + " 님 주말·공휴일 오프가 " + state.weekendBaseOff + "일, 평일 오프가 " +
            state.weekdayBaseOff + "일입니다."
        );
        penalty += weekendDiff * 12;
      }
    });

    const nightCounts = peopleStats.map(function (person) { return person.nights; }).sort(function (a, b) { return a - b; });
    const mid = nightCounts.length ? nightCounts[Math.floor(nightCounts.length / 2)] : 0;
    peopleStats.forEach(function (person) {
      penalty += Math.abs(person.nights - mid) * 4;
      if (person.nights > 6) {
        hard.push(person.name + " 님 나이트가 6개를 넘습니다.");
        penalty += 10000;
      }
    });

    return {
      hard: hard,
      soft: soft,
      penalty: penalty,
      stats: {
        weekdayAvg: weekdayAvg,
        weekendAvg: weekendAvg,
        baseOffTarget: input.baseOffTarget,
        days: dayStats,
        people: peopleStats,
      },
    };
  }

  function preparePeople(input) {
    const days = input.weekendLike.length;
    const baseOffTarget = input.weekendLike.filter(Boolean).length;
    const histories = input.staff.map(function (person) {
      return (input.history && input.history[person.id]) || historyStats(input.chain || [], person.id);
    });
    const tracked = histories.filter(function (item) { return item.weekendOffs + item.weekdayOffs > 0; });
    const avgWeekend =
      tracked.reduce(function (sum, item) { return sum + item.weekendOffs; }, 0) / (tracked.length || 1);
    const avgNights =
      histories.reduce(function (sum, item) { return sum + item.nights; }, 0) / (histories.length || 1);
    const staff = input.staff.map(function (person, index) {
      const requestSet = new Set(input.requests[person.id] || []);
      const plan = offPlanForPerson(baseOffTarget, requestSet, input.weekendLike, histories[index], tracked.length ? avgWeekend : 0);
      return {
        id: person.id,
        name: person.name,
        role: person.role,
        baseOffTarget: baseOffTarget,
        targetWeekend: plan.targetWeekend,
        targetWeekday: plan.targetWeekday,
        histNights: histories[index].nights,
        rolePool: input.staff.filter(function (other) { return other.role === person.role; }).length,
        roleUsedGuess: 0,
      };
    });
    const targets = planTargets({
      staffCount: staff.length,
      weekendLike: input.weekendLike,
      baseOffTarget: baseOffTarget,
      weekdayTarget: input.weekdayTarget,
      weekendTarget: input.weekendTarget,
    });
    return {
      staff: staff,
      baseOffTarget: baseOffTarget,
      avgHistNights: avgNights,
      dayTargets: targets.perDay,
      targetSummary: targets,
      days: days,
    };
  }

  function generateRoster(input) {
    if (!input.staff.length) {
      return { grid: {}, hard: [], soft: ["근무자를 먼저 추가해 주세요."], penalty: 0, stats: null };
    }
    const prepared = preparePeople(input);
    const merged = {
      staff: prepared.staff,
      weekendLike: input.weekendLike,
      requests: input.requests || {},
      carry: input.carry || {},
      baseOffTarget: prepared.baseOffTarget,
      dayTargets: prepared.dayTargets,
      avgHistNights: prepared.avgHistNights,
    };
    const restarts = input.restarts || (input.staff.length > 200 ? 8 : input.staff.length > 80 ? 14 : 28);
    let best = null;
    const seed = input.seed || 20261025;
    for (let restart = 0; restart < restarts; restart++) {
      const grid = buildOnce(merged, mulberry32(seed + restart * 9973));
      const report = assess(merged, grid);
      if (!best || report.penalty < best.penalty) {
        best = {
          grid: grid,
          hard: report.hard,
          soft: report.soft,
          penalty: report.penalty,
          stats: report.stats,
          targets: prepared.targetSummary,
        };
      }
    }
    return best;
  }

  function validateGrid(input, grid) {
    const prepared = preparePeople(input);
    const merged = {
      staff: prepared.staff,
      weekendLike: input.weekendLike,
      requests: input.requests || {},
      carry: input.carry || {},
      baseOffTarget: prepared.baseOffTarget,
      dayTargets: prepared.dayTargets,
      avgHistNights: prepared.avgHistNights,
    };
    const report = assess(merged, grid);
    report.targets = prepared.targetSummary;
    return report;
  }

  return {
    SHIFTS: SHIFTS,
    freshState: freshState,
    cloneState: cloneState,
    beginMonth: beginMonth,
    applyShift: applyShift,
    canAssign: canAssign,
    carryState: carryState,
    historyStats: historyStats,
    planTargets: planTargets,
    generateRoster: generateRoster,
    validateGrid: validateGrid,
  };
});
